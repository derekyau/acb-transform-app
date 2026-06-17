const fs = require('node:fs/promises');

async function transform({ inputPath, outputPath }) {
  // TODO: Implement the real IBKR CSV to ACB transformation logic here.
  await fs.copyFile(inputPath, outputPath);
}

module.exports = { transform };
