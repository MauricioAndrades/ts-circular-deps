import ts from 'typescript';

type Deps = string[];

// Define an interface Files which maps module names to arrays of their dependencies
interface Files {
    [module: string]: Deps;
}

function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {
    const ts = modules.typescript;

    function findCircularDeps(files: Files): Deps[] {
        const visited = new Set<string>();
        const inStack = new Set<string>();
        const circularDeps: Deps[] = [];

        const dfs = (node: string, stack: string[]): void => {
            visited.add(node);
            inStack.add(node);
            stack.push(node);

            if (files[node]) {
                for (const dep of files[node]) {
                    if (!visited.has(dep)) {
                        dfs(dep, stack);
                    } else if (inStack.has(dep)) {
                        const cycleStartIndex = stack.indexOf(dep);
                        circularDeps.push(stack.slice(cycleStartIndex));
                    }
                }
            }

            inStack.delete(node);
            stack.pop();
        };

        Object.keys(files).forEach(node => {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        });

        return circularDeps;
    }

    function create(info: ts.server.PluginCreateInfo) {
        const proxy: ts.LanguageService = Object.create(null);

        for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
            const x = info.languageService[k]!;
            // @ts-ignore
            proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
        }

        proxy.getSemanticDiagnostics = (fileName: string) => {
            console.log(fileName);
            const prior = info.languageService.getSemanticDiagnostics(fileName);
            const program = info.languageService.getProgram();
            if (!program) return prior;

            const sourceFile = program.getSourceFile(fileName);
            if (!sourceFile) return prior;

            const checker = program.getTypeChecker();
            const files: Files = {};

            program.getSourceFiles().forEach(sourceFile => {
                const fileName = sourceFile.fileName;
                const deps: string[] = [];
                ts.forEachChild(sourceFile, node => {
                    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
                        const moduleSpecifier = node.moduleSpecifier;
                        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
                            const importPath = moduleSpecifier.text;
                            const resolvedModule = ts.resolveModuleName(importPath, fileName, info.project.getCompilerOptions(), ts.sys);
                            if (resolvedModule.resolvedModule) {
                                deps.push(resolvedModule.resolvedModule.resolvedFileName);
                            }
                        }
                    }
                });
                files[fileName] = deps;
            });

            const circularDeps = findCircularDeps(files);
            if (circularDeps.length > 0) {
                const message = `Circular dependencies detected:\n${circularDeps.map(dep => dep.join(' -> ')).join('\n')}`;
                const diagnostic: ts.Diagnostic = {
                    file: sourceFile,
                    start: 0,
                    length: 0,
                    messageText: message,
                    category: ts.DiagnosticCategory.Error,
                    code: 9999,
                };
                return [...prior, diagnostic];
            }

            return prior;
        };

        return proxy;
    }

    return { create };
}

export = init;
