#!/usr/bin/env node

const path = require("path");

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
    .action(async (options) => {
        const dir = path.isAbsolute(options.directory) ? options.directory : path.join(process.cwd(), options.directory)
        check(dir)
    });

program.command('transpile')
    .description('Execute the transpiler')
    .option('--no-check', 'disable check')
    .option('-d, --directory <string>', 'rules directory', process.cwd())
    .action(async (options) => {
        const dir = path.isAbsolute(options.directory) ? options.directory : path.join(process.cwd(), options.directory)
        try {
            if (options.check) {
                await check(dir);
            }
            await transpiler(dir);
        } catch (e) {
            console.error(e);
        }
    });

program.parse();