#!/usr/bin/env node

const { version } = require('../package.json');
const { Command } = require('commander');
const { check } = require('../lib/checker');
const { transpiler } = require('../lib/transpiler');

const program = new Command();

program
    .name('featws-cli')
    .description('FeatWS CLI')
    .version(version);

program.command('check')
    .description('Execute the checker')
    .option('-d, --directory <string>', 'rules directory', process.cwd())
    .action(async (options) => check(options.directory));

program.command('transpile')
    .description('Execute the transpiler')
    .option('--no-check', 'disable check')
    .option('-d, --directory <string>', 'rules directory', process.cwd())
    .action(async (options) => {
        try {
            if (options.check) {
                await check(options.directory);
            }
            await transpiler(options.directory);
        } catch (e) {
            console.error(e);
        }
    });

program.parse();