const mysql = require("mysql");
const EventEmitter = require("node:events");
const l2Algos = require("./passwordAlgos.js");

class dbClass extends EventEmitter {

    constructor(item) { super(); this.#item = item; }

    #loginServer;
    #gameServer;
    #item;
    #algo;

    CREATE_LOGIN = async (Obj) => {

        this.#loginServer = mysql.createConnection(Obj);
        this.#loginServer.on("error", () => { this.emit("error", "Connection to loginserver database lost"); });

        return true;
    }

    CREATE_GAME = async (Obj) => {

        this.#gameServer = mysql.createConnection(Obj);
        this.#gameServer.on("error", () => { this.emit("error", "Connection to gameserver database lost"); });

        return true;
    }

    CONNECT_LOGIN = async () => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.connect((error) => { return (error) ? reject(error) : resolve(true); });
        });
    }

    CONNECT_GAME = async () => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.connect((error) => { return (error) ? reject(error) : resolve(true); });
        });
    }

    VALIDATE_DATABASE = async () => {

        const accounts = "ALTER TABLE `accounts` ADD COLUMN IF NOT EXISTS `ethAddress` VARCHAR(42) NOT NULL DEFAULT 'not linked'";
        const donation_balances = "CREATE TABLE IF NOT EXISTS `donation_balances` (`server_id` INT(11) NOT NULL, `balance` MEDIUMINT(10) UNSIGNED NOT NULL DEFAULT '0', `nChars` MEDIUMINT(10) UNSIGNED NOT NULL DEFAULT '0', PRIMARY KEY(`server_id`)) ENGINE = InnoDB DEFAULT CHARSET = utf8";
        const donation_deposits = "CREATE TABLE IF NOT EXISTS `donation_deposits` (`txHash` VARCHAR(66) NOT NULL, `server_id` INT(11) NOT NULL, `character` VARCHAR(35) NOT NULL, `from` VARCHAR(42) NOT NULL, `symbol` VARCHAR(7) NOT NULL, `amount` MEDIUMINT(10) UNSIGNED NOT NULL, PRIMARY KEY(`txHash`)) ENGINE = InnoDB DEFAULT CHARSET = utf8";
        const donation_withdrawals = "CREATE TABLE IF NOT EXISTS `donation_withdrawals` (`txHash` VARCHAR(66) NOT NULL, `server_id` INT(11) NOT NULL, `character` VARCHAR(35) NOT NULL, `to` VARCHAR(42) NOT NULL, `symbol` VARCHAR(7) NOT NULL, `amount` MEDIUMINT(10) UNSIGNED NOT NULL, PRIMARY KEY(`txHash`)) ENGINE = InnoDB DEFAULT CHARSET = utf8";
        const donation_temporary = "CREATE TABLE IF NOT EXISTS `donation_temporary` (`server_id` INT(11) NOT NULL, `owner` INT(11) NOT NULL, `item` SMALLINT(5) UNSIGNED NOT NULL, `amount` MEDIUMINT(10) UNSIGNED NOT NULL, `refund` INT(10) UNSIGNED NOT NULL, PRIMARY KEY(`server_id`, `owner`, `refund`)) ENGINE = InnoDB DEFAULT CHARSET = utf8";

        return await new Promise(async (resolve, reject) => {

            const accs = this.#loginServer.query(accounts);
            const gsB = this.#loginServer.query(donation_balances);
            const deps = this.#loginServer.query(donation_deposits);
            const withs = this.#loginServer.query(donation_withdrawals);
            const temp = this.#loginServer.query(donation_temporary);

            Promise.all([accs, gsB, deps, withs, temp]).catch((error) => { return reject(error); }).then(() => { return resolve(true); })
        });
    }

    GET_ID = async () => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `server_id` FROM `gameservers`", (error, result) => {

                if (error)
                    return reject(error);

                if (result.length == 1)
                    return resolve(result[0].server_id);

                return resolve(false);
            });
        });
    }

    GET_ACCOUNTS = async (ethAddress) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("SELECT `login` FROM `accounts` WHERE `ethAddress` = ?", [ethAddress], (error, result) => {

                if (error)
                    return reject(error);

                const nR = result.length;
                let accounts = [];

                for (let i = 0; i < nR; i++)
                    accounts.push(result[i].login);

                return resolve(accounts);
            });
        });
    }

    VERIFY_PASSWORD = async (username, password) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("SELECT `password` FROM `accounts` WHERE `login` = ?", [username], (error, result) => {

                if (error)
                    return reject(error);

                let verified = false;

                if (result.length == 1) {

                    const targetPassword = result[0].password;

                    if (this.#algo != undefined) {

                        switch (this.#algo) {

                            case 1:
                                if (l2Algos.one(password) == targetPassword)
                                    verified = true;
                                break;
                            case 2:
                                if (l2Algos.two(password) == targetPassword)
                                    verified = true;
                                break;
                            case 3:
                                if (l2Algos.three(password) == targetPassword)
                                    verified = true;
                                break;
                            case 4:
                                if (l2Algos.four(password) == targetPassword)
                                    verified = true;
                                break;
                            case 5:
                                if (l2Algos.five(password) == targetPassword)
                                    verified = true;
                                break;
                        }
                    }
                    else {

                        if (l2Algos.one(password) == targetPassword) {

                            verified = true;
                            this.#algo = 1;
                        }
                        else if (l2Algos.two(password) == targetPassword) {

                            verified = true;
                            this.#algo = 2;
                        }
                        else if (l2Algos.three(password) == targetPassword) {

                            verified = true;
                            this.#algo = 3;
                        }
                        else if (l2Algos.four(password) == targetPassword) {

                            verified = true;
                            this.#algo = 4;
                        }
                        else if (l2Algos.five(password) == targetPassword) {

                            verified = true;
                            this.#algo = 5;
                        }
                    }

                    return resolve(verified);
                }

                return resolve(false);
            });
        });

    }

    ADD_ADDRESS = async (username, ethAddress) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("UPDATE `accounts` SET `ethAddress` = ? WHERE `login` = ? AND `ethAddress` = 'not linked'", [ethAddress, username], (error, result) => {

                if (error)
                    return reject(error);

                if (result.changedRows == 1)
                    return resolve(true);

                return resolve(false);
            });
        });
    }

    REMOVE_ADDRESS = async (username, ethAddress) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("UPDATE `accounts` SET `ethAddress` = 'not linked' WHERE `login` = ? AND `ethAddress` = ?", [username, ethAddress], (error, result) => {

                if (error)
                    return reject(error);

                if (result.changedRows == 1)
                    return resolve(true);

                return resolve(false);
            });
        });
    }

    GET_CHARACTERS = async (username) => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `char_name` FROM `characters` WHERE `account_name` = ?", [username], (error, result) => {

                if (error)
                    return reject(error);

                const nR = result.length;
                let characters = [];

                for (let i = 0; i < nR; i++)
                    characters.push(result[i].char_name);

                return resolve(characters);
            });
        });
    }

    GET_CHARACTER_BALANCE = async (character) => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `obj_Id` FROM `characters` WHERE `char_name` = ?", [character], async (error, result) => {

                if (error)
                    return reject(error);

                if (!(result && result.length == 1))
                    return resolve(false);

                const data = await new Promise((res) => {

                    this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#item], (e, r) => {

                        if (e)
                            return res({ "error": e });

                        if (r && r.length == 1)
                            return res(r[0].count);

                        if (r && r.length == 0)
                            return res(0);

                        return res(false);
                    });
                });

                if (data.error)
                    return reject(data.error);

                return resolve(data);
            });
        });
    }

    ADD_REFUND_AND_DECREASE_BALANCE = async (serverid, character, amount, address) => { //SETS AND RETURNS THE REFUND TIMESTAMP

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `account_name`, `obj_Id` FROM `characters` WHERE `char_name` = ?", [character], async (error, result) => {

                if (error)
                    return reject(error);

                if (!(result && result.length == 1))
                    return resolve(false);

                let data;

                data = await new Promise((res) => {

                    this.#loginServer.query("SELECT `ethAddress` FROM `accounts` WHERE `login` = ?", [result[0].account_name], (e, r) => {

                        if (e)
                            return res({ "error": e });

                        if (r && r.length == 1)
                            return res(r[0].ethAddress);

                        return res(false);
                    });
                });

                if (data.error)
                    return reject(data.error);

                if (data === false || data != address)
                    return resolve(false);

                data = await new Promise((res) => {

                    this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#item], (e, r) => {

                        if (e)
                            return res({ "error": e });

                        if (r && r.length == 1)
                            return res(r[0].count);

                        return res(false);
                    });
                });

                if (data.error)
                    return reject(data.error);

                if (data === false)
                    return resolve(false);

                data = await new Promise((res) => {

                    if (data == amount) {

                        this.#gameServer.query("DELETE FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#item], (e) => {

                            if (e)
                                return res({ "error": e });

                            return res(true);
                        });
                    }
                    else if (data > amount) {

                        this.#gameServer.query("UPDATE `items` SET `count` = `count` - ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [amount, result[0].obj_Id, this.#item], (e) => {

                            if (e)
                                return res({ "error": e });

                            return res(true);
                        });
                    }
                    else
                        return res(false);
                });

                if (data.error)
                    return reject(data.error);

                if (data === false)
                    return resolve(false);

                data = await new Promise((res) => {

                    const refund = Math.floor(Date.now() / 1000) + 120;

                    this.#loginServer.query("INSERT INTO `donation_temporary` (`server_id`, `owner`, `item`, `amount`, `refund`) VALUES (?, ?, ?, ?, ?)", [serverid, result[0].obj_Id, this.#item, amount, refund], (e, r) => {

                        if (e)
                            return res({ "error": e });

                        return res(refund);
                    });
                });

                if (data.error)
                    return reject(data.error);

                return resolve(data);
            });
        });
    }

    INCREASE_BALANCE = async (character, amount) => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `obj_Id` FROM `characters` WHERE `char_name` = ?", [character], async (error, result) => {

                if (error)
                    return reject(error);

                if (!(result && result.length == 1))
                    return resolve(false);

                let data;

                data = await new Promise((res) => {

                    this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#item], (e, r) => {

                        if (e)
                            return res({ "error": e });

                        if (r && r.length == 1)
                            return res(r[0].count);

                        if (r && r.length == 0)
                            return res(-1);

                        return res(false);
                    });
                });

                if (data.error)
                    return reject(data.error);

                if (data === false)
                    return resolve(false);

                data = await new Promise(async (res) => {

                    if (data === -1) {

                        let objID;

                        do {

                            objID = await new Promise((rsp) => {

                                const testID = Math.floor(Math.random() * 2147483646);

                                this.#gameServer.query("SELECT `object_id` FROM `items` WHERE `object_id` = ?", [testID], (e, r) => {

                                    if (!e && r && r.length == 0)
                                        return rsp(testID);

                                    return rsp(false);
                                });
                            })

                        } while (objID === false);

                        this.#gameServer.query("INSERT INTO `items` (`owner_id`, `object_id`, `item_id`, `count`, `loc`) VALUES (?, ?, ?, ?, 'inventory')", [result[0].obj_Id, objID, this.#item, amount], (e) => {

                            if (e)
                                return res({ "error": e })

                            return res(true);
                        });
                    }
                    else {

                        this.#gameServer.query("UPDATE `items` SET `count` = `count` + ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [amount, result[0].obj_Id, this.#item], (e) => {

                            if (e)
                                return res({ "error": e })

                            return res(true);
                        });
                    }
                });

                if (data.error)
                    return reject(data.error);

                return resolve(true);
            });
        });
    }

    REMOVE_REFUND = async (serverid, character, amount, refund) => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT `obj_Id` FROM `characters` WHERE `char_name` = ?", [character], async (error, result) => {

                if (error)
                    return reject(error);

                if (!(result && result.length == 1))
                    return resolve(false);

                let data;

                data = await new Promise((res) => {

                    this.#loginServer.query("DELETE FROM `donation_temporary` WHERE `server_id` = ? AND `owner` = ? AND item = ? AND `amount` = ? AND `refund` = ?", [serverid, result[0].obj_Id, this.#item, amount, refund], (e) => {

                        if (e)
                            return res(e);

                        return res(true);
                    });
                });

                if (data.error)
                    return reject(data.error);

                return resolve(true);
            });
        });
    }

    LOG_DEPOSIT = async (txHash, serverid, character, from, symbol, amount) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("INSERT INTO `donation_deposits` (`txHash`, `server_id`, `character`, `from`, `symbol`, `amount`) VALUES (?, ?, ?, ?, ?, ?)", [txHash, serverid, character, from, symbol, amount], (error) => {

                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    LOG_WITHDRAWAL = async (txHash, serverid, character, to, symbol, amount) => {

        return await new Promise((resolve) => {

            this.#loginServer.query("INSERT INTO `donation_withdrawals` (`txHash`, `server_id`, `character`, `to`, `symbol`, `amount`) VALUES (?, ?, ?, ?, ?, ?)", [txHash, serverid, character, to, symbol, amount], (error) => {

                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    REFUND_EXPIRED = async (serverid) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("SELECT `owner`, `amount`, `refund` FROM `donation_temporary` WHERE `server_id` = ? AND `item` = ? AND `refund` < ? ", [serverid, this.#item, Math.floor(Date.now() / 1000) - 180], async (error, result) => {

                if (error)
                    return reject(error);

                const nResult = result.length;

                let data;

                for (let i = 0; i < nResult; i++) {

                    data = await new Promise((res) => {

                        this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[i].owner, this.#item], (e, r) => {

                            if (e)
                                return res({ "error": e });

                            if (r && r.length == 1)
                                return res(r[0].count);

                            if (r && r.length == 0)
                                return res(-1);

                            return res(false);
                        });
                    });

                    if (data.error)
                        return reject(data.error);

                    if (data === false)
                        continue;

                    data = await new Promise(async (res) => {

                        if (data === -1) {

                            let objID;

                            do {

                                objID = await new Promise((rsp) => {

                                    const testID = Math.floor(Math.random() * 2147483646);

                                    this.#gameServer.query("SELECT `object_id` FROM `items` WHERE `object_id` = ?", [testID], (e, r) => {

                                        if (!e && r && r.length == 0)
                                            return rsp(testID);

                                        return rsp(false);
                                    });
                                })

                            } while (objID === false);

                            this.#gameServer.query("INSERT INTO `items` (`owner_id`, `object_id`, `item_id`, `count`, `loc`) VALUES (?, ?, ?, ?, 'inventory')", [result[i].owner, objID, this.#item, result[i].amount], (e) => {

                                if (e)
                                    return res({ "error": e })

                                return res(true);
                            });
                        }
                        else {

                            this.#gameServer.query("UPDATE `items` SET `count` = `count` + ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[i].amount, result[i].owner, this.#item], (e) => {

                                if (e)
                                    return res({ "error": e })

                                return res(true);
                            });
                        }
                    });

                    if (data.error)
                        return reject(data.error);

                    data = await new Promise((res) => {

                        this.#loginServer.query("DELETE FROM `donation_temporary` WHERE `server_id` = ? AND `owner` = ? AND item = ? AND `amount` = ? AND `refund` = ?", [serverid, result[i].owner, this.#item, result[i].amount, result[i].refund], (e) => {

                            if (e)
                                return res({ "error": e });

                            return res(true);
                        });
                    });

                    if (data.error)
                        return reject(data.error);
                }

                return resolve(true);
            });
        });
    }

    GET_GAMESERVER_BALANCE = async () => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT SUM(`count`) AS balance FROM `items`", async (error, result) => {

                if (error)
                    return reject(error);

                if (result && result.length == 1)
                    return resolve((result[0].balance != null) ? (result[0].balance) : (0));

                return resolve(false);
            });
        });
    }

    GET_LOGINSERVER_DATA = async (serverid) => {

        return await new Promise((resolve, reject) => {

            this.#loginServer.query("SELECT SUM(`balance`) AS balance, SUM(`nChars`) AS nChars FROM `donation_balances`", async (error, result) => {

                if (error)
                    return reject(error);

                if (result && result.length == 1)
                    return resolve({ "balance": ((result[0].balance != null) ? (result[0].balance) : (0)), "nChars": ((result[0].nChars != null) ? (result[0].nChars) : (0)) });

                return resolve(false);
            });
        });
    }

    UPDATE_LOGINSERVER_DATA = async (serverid) => {

        return await new Promise((resolve, reject) => {

            this.#gameServer.query("SELECT SUM(`count`) AS balance, COUNT(`count`) AS nChars  FROM `items`", async (error, result) => {

                if (error)
                    return reject(error);

                if (result && result.length == 1) {

                    const balance = ((result[0].balance != null) ? (result[0].balance) : (0));
                    const nChars = ((result[0].nChars != null) ? (result[0].nChars) : (0));

                    const data = await new Promise((res) => {

                        this.#loginServer.query("INSERT INTO `donation_balances` (`server_id`, `balance`, `nChars`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `balance` = ?, `nChars` = ?", [serverid, balance, nChars, balance, nChars], (e) => {

                            if (e)
                                return res({ "error": e });

                            return res(true);
                        });
                    });

                    if (data.error)
                        return reject(data.error);

                    return resolve(true);
                }

                return resolve(false);
            });
        });
    }
}

module.exports = dbClass;