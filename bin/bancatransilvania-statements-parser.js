#!/usr/bin/env node
"use strict";

const Tilda = require("tilda")
    , bancatransilvaniaStatementsParser = require("..")
    ;

new Tilda(`${__dirname}/../package.json`, {
    args: [{
        name: "statement",
        type: String,
        desc: "The path to the statement PDF file to be parsed."
    }],
    examples: [
        "bancatransilvania-statements-parser statement.pdf"
    ]
}).main(action => {
    bancatransilvaniaStatementsParser.parse(action.args.statement)
});