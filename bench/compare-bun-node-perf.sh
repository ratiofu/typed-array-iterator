echo "Building for node..."
bun build ./bench/index.ts --target node --outdir ./dist --external @mitata/counters
echo "First, the Bun version of the benchmarks will be run, then the Node version."
echo "To get performance counters, "sudo" is required, so you'll be prompted for your password."

echo ""
echo "Running Bun..."
sudo bun --expose-gc ./bench/index.ts 200000

echo ""
echo "Running Node..."
node --expose-gc ./dist/index.js 200000
