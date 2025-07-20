## Documentation

You can see below the API reference of this module.

### `BancaTransilvaniaStatementsParser.parse(inputPdfPath)`
parse
Parses the PDF file at the given path and writes the transactions to a CSV file.

#### Params

- **string** `inputPdfPath`: - The path to the PDF file to parse.

### `convertToDate(dateStr)`
Converts a date string in the format "DD/MM/YYYY" to a JavaScript Date object.

#### Params

- **string** `dateStr`: - The date string to convert.

#### Return
- **Date** The converted Date object.

### `processTransactionDescription(description)`
Processes the transaction description to extract relevant information and normalize it.

#### Params

- **string** `description`: - The transaction description to process.

#### Return
- **string|object** The processed description, which can be a string or an object with additional metadata.

### `processTransaction(account, transaction)`
Processes a transaction object by extracting relevant information from its raw lines.

#### Params

- **Object** `account`: - The account object containing metadata and space offsets.
- **Object** `transaction`: - The transaction object to process, containing raw lines and other properties.

### `parseInput(input, stream)`
Parses the input string and extracts account statements and transactions.

#### Params

- **string** `input`: - The input string containing the account statements.
- **Object** `stream`: - The stream to write the parsed transactions to.

#### Return
- **Array** An array of account objects, each containing metadata and transactions.

