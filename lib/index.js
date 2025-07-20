"use strict";

const csv = require("csv-it")
const daty = require("daty");
const fs = require("fs")
const spawn = require("child_process").spawn;

class BancatransilvaniaStatementsParser {

    /**
     * parse
     * Parses the PDF file at the given path and writes the transactions to a CSV file.
     * 
     * @param {string} inputPdfPath - The path to the PDF file to parse.
     * @function
     * @name BancaTransilvaniaStatementsParser.parse
     * @throws {Error} If the inputPdfPath is not provided.
     */
    static parse(inputPdfPath) {

        if (!inputPdfPath) {
            throw new Error('Please provide the path to the PDF file as an argument.');
        }

        const baseName = inputPdfPath.split('/').pop().replace('.pdf', '');
        const transactions = csv.writeAsync(`${baseName}.csv`, {
            headers: [
                //'type',
                //'description',
                'raw_description',
                //'destination_account',
                //'destination_iban',
                //'destination_name',
                'account_number',
                'iban',
                'currency',
                'date',
                'reference',
                'debit',
                'credit',
            ]
        }, () => {
            console.log('CSV file created successfully.');
        });

        spawn("pdftotext", ["-layout", inputPdfPath, `${baseName}.txt`], {
            stdio: 'inherit'
        }).on('close', (code) => {
            if (code !== 0) {
                console.error(`pdftotext process exited with code ${code}`);
                return;
            }
            console.log('PDF converted to text successfully.');
            const INPUT = fs.readFileSync(`${baseName}.txt`, 'utf-8');
            BancatransilvaniaStatementsParser.parseInput(INPUT, transactions);
            transactions.end()
        });
    }

    /**
     * convertToDate
     * Converts a date string in the format "DD/MM/YYYY" to a JavaScript Date object.
     * 
     * @name convertToDate
     * @function
     * @param {string} dateStr - The date string to convert.
     * @return {Date} The converted Date object.
     */
    static convertToDate(dateStr) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}T00:00:00`);
    }

    /**
     * processTransactionDescription
     * Processes the transaction description to extract relevant information and normalize it.
     * 
     * @name processTransactionDescription
     * @function
     * @param {string} description - The transaction description to process.
     * @return {string|object} The processed description, which can be a string or an object with additional metadata.
     */
    static processTransactionDescription(description) {

        const matches = [{
            regex: /Pachet IZI/,
            replacement: "BT Pachet IZI"
        }, {
            regex: /Schimb valutar/,
            replacement: "Schimb valutar"
        }, {
            regex: /Comision plata OP/,
            replacement: "Comision plata OP"
        }, {
            regex: /Incasare valutara/,
            process() {
                const lines = description.split('\n').map(c => c.trim()).map(c => {
                    return c.replace(/\s{2,}.*$/, '').trim();
                })

                if (!/^\d{2}\/\d{2}\/\d{4}/.test(lines[0])) {
                    lines.shift();
                }

                return "Incasare valutara: " + lines.join(' ')
            }
        }, {
            regex: /Plata OP (inter|intra)/,
            process: () => {
                const lines = description.split('\n').map(c => c.trim()).map(c => {
                    // Rpleace many spces followed by something, erasing what follows
                    return c.replace(/\s{2,}.*$/, '').trim();
                })

                let destinationSplits = lines[2].split(';').map(c => c.trim()).filter(Boolean)

                let destinationName = null;
                let destinationIban = null;
                let destinationAccount = null;
                let customDescription = null;

                if (destinationSplits.length > 2) {
                    destinationName = destinationSplits[0] || null;
                    destinationIban = destinationSplits[1] || null;
                    destinationAccount = destinationSplits[2] || null;
                } else {
                    destinationIban = destinationSplits[0] || null;
                    destinationAccount = destinationSplits[1] || null;
                }

                const meta = {
                    destinationName: destinationName || null,
                    destinationIban: destinationIban || null,
                    destinationAccount: destinationAccount || null,
                }


                if (lines[0].includes("intra")) {
                    destinationSplits = lines[1].split(';').map(c => c.trim()).filter(Boolean)
                    customDescription = destinationSplits[0]
                    meta.destinationName = destinationSplits[2] || null;
                    meta.destinationIban = destinationSplits[3] || null;
                } else if (lines[0].includes("inter")) {
                    const descSplits = lines[1].split(';').map(c => c.trim()).filter(Boolean);
                    customDescription = descSplits[4]
                }


                meta.type = lines[0]
                meta.custom_description = customDescription || null;

                return meta
            }
        }]

        for (const match of matches) {
            if (match.regex.test(description)) {
                if (match.process) {
                    return match.process();
                }
                return match.replacement
            }
        }

        return description
    }

    /**
     * processTransaction
     * Processes a transaction object by extracting relevant information from its raw lines.
     * 
     * @name processTransaction
     * @function
     * @param {Object} account - The account object containing metadata and space offsets.
     * @param {Object} transaction - The transaction object to process, containing raw lines and other properties.
     */
    static processTransaction(account, transaction) {

        const rawLines = transaction.raw;
        const referenceMatch = rawLines.find(line => line.trim().startsWith('REF:') || line.trim().startsWith('REF.'));

        if (referenceMatch) {
            transaction.reference = referenceMatch.replace('REF:', '').replace("REF.", "").trim();
        }

        if (!transaction.reference) {
            debugger
        }

        let firstLine = null
        let value = null;
        let valueOffset = null;

        do {
            firstLine = rawLines[0]
            // Detect 10 spaces folowed by a number (123.01, 2.00, 1,234.56, etc.)
            const re = /\s{10}([0-9.,]+)$/;
            const match = firstLine.match(re);
            if (match) {
                value = match[1];
                valueOffset = firstLine.indexOf(value);
            }

            if (value) {
                break;
            }

            debugger
            rawLines.shift();
        } while (true)

        if (!value) {
            debugger
        }

        if (valueOffset > account.spaceOffsets.debit + 10) {
            transaction.credit = parseFloat(value.replace(',', ''));
        } else {
            transaction.debit = parseFloat(value.replace(',', ''));
        }

        if (!transaction.debit && !transaction.credit) {
            debugger
        }


        const dateMatch = rawLines.find(line => /^\d{2}\/\d{2}\/\d{4}/.test(line.trim()));
        if (dateMatch) {
            const dateStr = dateMatch.trim().split(' ')[0];
            const [day, month, year] = dateStr.split('/');
            transaction.date = new Date(`${year}-${month}-${day}T00:00:00`);
            if (isNaN(transaction.date.getTime())) {
                debugger;
            }
        }

        if (!transaction.date) {
            transaction.date = BancatransilvaniaStatementsParser.lastDate
        } else {
            BancatransilvaniaStatementsParser.lastDate = transaction.date;
        }

        if (!transaction.date) {
            debugger
        }

        const descriptionMatch = rawLines.join("\n")
        transaction.rawDescription = descriptionMatch;
        transaction.description = BancatransilvaniaStatementsParser.processTransactionDescription(descriptionMatch)
        transaction.type = "Main";

        let meta = transaction.description;
        if (typeof transaction.description !== 'string') {
            transaction.destinationName = meta.destinationName || null;
            transaction.destinationIban = meta.destinationIban || null;
            transaction.destinationAccount = meta.destinationAccount || null;
            transaction.type = meta.type || 'Unknown';
            transaction.description = meta.custom_description || null;
        }

        if (!transaction.description) {
            meta;
            debugger
        }

    }

    /**
     * parseInput
     * Parses the input string and extracts account statements and transactions.
     * 
     * @name parseInput
     * @function
     * @param {string} input - The input string containing the account statements.
     * @param {Object} stream - The stream to write the parsed transactions to.
     * @return {Array} An array of account objects, each containing metadata and transactions.
     */
    static parseInput(input, stream) {
        const lines = input.split('\n');
        const results = [];
        let current = null;
        let inTransactions = false;
        let lastRefLines = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detect start of a new account statement
            if (trimmedLine.startsWith('EXTRAS CONT')) {
                if (current) {
                    results.push(current);
                }
                current = {
                    metadata: {
                        accountNumber: null,
                        iban: null,
                        currency: null,
                        period: null,
                        number: null,
                    },
                    transactions: [],
                };

                inTransactions = false;

                const numMatch = trimmedLine.match(/Numarul:\s*(\d+)/);
                if (numMatch) current.metadata.number = numMatch[1];
                const periodMatch = trimmedLine.match(/din\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
                if (periodMatch) {
                    current.metadata.period = [periodMatch[1], periodMatch[2]];
                    current.period = current.metadata.period.map(dateStr => BancatransilvaniaStatementsParser.convertToDate(dateStr));
                }
            } else if (current && trimmedLine.startsWith('CONT ')) {
                const accMatch = trimmedLine.match(/^CONT\s+([A-Z0-9]+)/);
                if (accMatch) current.metadata.accountNumber = accMatch[1];
            } else if (current && trimmedLine.match(/^\w{3}\s+Cod IBAN:/)) {
                const currMatch = trimmedLine.match(/^(\w{3})\s+Cod IBAN:/);
                if (currMatch) current.metadata.currency = currMatch[1];
                const ibanMatch = trimmedLine.match(/Cod IBAN:\s*([A-Z0-9]+)/);
                if (ibanMatch) current.metadata.iban = ibanMatch[1];
            }

            // Detect start of transactions table
            if (current && trimmedLine.match(/^Data\s+Descriere\s+Debit\s+Credit/)) {
                inTransactions = true;
                current.spaceOffsets = {
                    date: line.indexOf('Data'),
                    description: line.indexOf('Descriere'),
                    debit: line.indexOf('Debit'),
                    credit: line.indexOf('Credit'),
                }
                continue;
            }

            // Parse transactions
            if (current && inTransactions) {
                // Check if the line contains REF: followed by a reference
                const refMatch = line.match(/REF(:|\.)\s*([A-Z0-9]+)/);
                const IGNORED_LINES = [
                    'SOLD ANTERIOR',
                    'SOLD FINAL ZI',
                    'RULAJ TOTAL CONT',
                    'RULAJ ZI',
                    'SOLD FINAL CONT',
                    'TOTAL DISPONIBIL',
                    'Fonduri proprii',
                    'Credit neutilizat',
                ];

                if (IGNORED_LINES.some(ignored => line.includes(ignored))) {
                    continue;
                }

                // Check if starts with date
                if (/^\d{2}\/\d{2}\/\d{4}/.test(line.trim())) {
                    lastRefLines = [];
                }

                if (!/REF(:|\.)/.test(lastRefLines.join(" ")) && line === '') {
                    //  lastRefLines = [];
                }

                if (lastRefLines.join(" ").includes("REF: ") && line === '') {
                    // debugger
                }

                lastRefLines.push(line);
                if (refMatch) {
                    const ref = refMatch[1];
                    const transaction = {
                        raw: lastRefLines,
                        reference: null,
                        date: null,
                        description: null,
                        debit: null,
                        credit: null,
                    }
                    BancatransilvaniaStatementsParser.processTransaction(current, transaction);
                    stream.write({
                        account_number: current.metadata.accountNumber,
                        iban: current.metadata.iban,
                        currency: current.metadata.currency,
                        date: new daty(transaction.date).format("YYYY-MM-DD"),
                        reference: transaction.reference,
                        debit: transaction.debit || 0,
                        credit: transaction.credit || 0,
                        description: (transaction.description || "N/A").replace(/\n/g, ' '),
                        destination_account: transaction.destinationAccount || null,
                        destination_iban: transaction.destinationIban || null,
                        destination_name: transaction.destinationName || null,
                        type: transaction.type || 'Unknown',
                        raw_description: transaction.rawDescription || null,
                    })
                    lastRefLines = [];
                }
            }
        }

        // Push last account
        if (current) {
            results.push(current);
        }

        return results;
    }
}

module.exports = BancatransilvaniaStatementsParser;