const dbConfig = require("./db.config");

const {
    pool,
    retry,
    logging,
    ...connectionConfig
} = dbConfig;

module.exports ={
    development: {
        ...connectionConfig,
        logging: console.log
    }
}