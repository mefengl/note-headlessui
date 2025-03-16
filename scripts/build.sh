#!/usr/bin/env bash

# =============================================================================
# Headless UI 构建脚本
#
# 这个脚本负责将TypeScript源码编译为各种格式(ESM、CJS)的JavaScript产物，
# 同时生成类型定义文件，并进行代码优化和清理。
# =============================================================================

# 设置错误即退出模式，确保任何命令失败时整个脚本都会停止执行
set -e

# 获取当前脚本所在的目录路径，用于后续引用其他相关脚本
SCRIPT_DIR=$(cd ${0%/*} && pwd -P)

# =============================================================================
# Next.js 桶文件优化（Barrel File Optimization）
#
# 这部分目前被注释掉了，但其目的是使 Next.js 的桶文件（index 文件，用于重新导出多个模块）
# 进行优化。使用 @swc-node/register 是因为需要处理 TypeScript 文件。
# 
# 桶文件优化可以提高导入效率，减少不必要的代码加载。
# =============================================================================
# node -r @swc-node/register "${SCRIPT_DIR}/make-nextjs-happy.js"

# =============================================================================
# 定义基本变量
# =============================================================================
SRC='./src'           # 源码目录
DST='./dist'          # 构建产物目录
name="headlessui"     # 包名
input="./${SRC}/index.ts" # 入口文件

# =============================================================================
# 查找构建过程中需要的工具脚本
# =============================================================================
resolver="${SCRIPT_DIR}/resolve-files.js"        # 用于解析文件路径
rewriteImports="${SCRIPT_DIR}/rewrite-imports.js" # 用于重写导入语句

# =============================================================================
# 设置 esbuild 的共享选项
# =============================================================================
sharedOptions=()
sharedOptions+=("--platform=browser") # 指定构建目标为浏览器环境
sharedOptions+=("--target=es2019")    # 指定目标ECMAScript版本，确保广泛兼容性

# =============================================================================
# 生成实际的构建产物
# =============================================================================

# ------------ ESM (ECMAScript Modules) 格式构建 ------------
# 设置解析器选项，指定要处理的源文件
resolverOptions=()
resolverOptions+=($SRC)                      # 源码目录
resolverOptions+=('/**/*.{ts,tsx}')          # 匹配所有TypeScript文件
resolverOptions+=('--ignore=.test.,__mocks__') # 忽略测试和模拟文件

# 获取所有需要处理的输入文件
INPUT_FILES=$($resolver ${resolverOptions[@]})

# 构建两种ESM格式:
# 1. 分离的模块文件 - 每个源文件对应一个输出文件，保持原有的目录结构
NODE_ENV=production  npx esbuild $INPUT_FILES --format=esm --outdir=$DST               --outbase=$SRC --minify --pure:React.createElement --define:process.env.TEST_BYPASS_TRACKED_POINTER="false" --define:__DEV__="false" ${sharedOptions[@]} &

# 2. 单文件捆绑 - 将所有源码打包成一个ESM文件
NODE_ENV=production  npx esbuild $input       --format=esm --outfile=$DST/$name.esm.js --outbase=$SRC --minify --pure:React.createElement --define:process.env.TEST_BYPASS_TRACKED_POINTER="false" --define:__DEV__="false" ${sharedOptions[@]} &

# ------------ CommonJS 格式构建 ------------
# 构建两种CJS格式，一个用于生产(压缩)，一个用于开发(未压缩):

# 生产环境构建 - 压缩的CommonJS模块
NODE_ENV=production  npx esbuild $input --format=cjs --outfile=$DST/$name.prod.cjs --minify --bundle --pure:React.createElement --define:process.env.TEST_BYPASS_TRACKED_POINTER="false" --define:__DEV__="false" ${sharedOptions[@]} $@ &

# 开发环境构建 - 未压缩的CommonJS模块，启用了开发模式特性
NODE_ENV=development npx esbuild $input --format=cjs --outfile=$DST/$name.dev.cjs           --bundle --pure:React.createElement --define:process.env.TEST_BYPASS_TRACKED_POINTER="false" --define:__DEV__="true" ${sharedOptions[@]} $@ &

# =============================================================================
# 生成类型定义文件
# =============================================================================

# 生成ESM格式的TypeScript类型声明文件
tsc --emitDeclarationOnly --outDir $DST &

# 等待所有后台任务完成
wait

# =============================================================================
# 生成CommonJS类型声明
# =============================================================================

# 复制ESM类型声明文件来创建CJS类型声明文件
# 这是一个技巧，因为同样的类型定义适用于两种模块格式
cp $DST/index.d.ts $DST/index.d.cts

# =============================================================================
# 完成构建后的操作
# =============================================================================

# 复制构建目录中的额外文件到输出目录
cp -rf ./build/* $DST/

# 再次等待所有后台任务完成
wait

# =============================================================================
# 导入路径重写和清理
# =============================================================================

# 重写ES模块导入路径，确保它们在浏览器环境中正常工作
$rewriteImports "$DST" '/**/*.js'     # 处理JavaScript文件
$rewriteImports "$DST" '/**/*.d.ts'   # 处理TypeScript声明文件

# 移除测试相关文件，保持发布包的整洁
rm -rf `$resolver "$DST" '/**/*.{test,__mocks__,}.*'`   # 删除测试和模拟文件
rm -rf `$resolver "$DST" '/**/test-utils/*'`           # 删除测试工具目录
