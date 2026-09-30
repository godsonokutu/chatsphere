const dbConfig = require("./db.config");
const {Sequelize} = require("sequelize");

const sequelize = new Sequelize(
    dbConfig
);

module.exports = sequelize;
