const mysql = require("mysql2");
const EventEmitter = require("node:events");
const crypto = require("node:crypto");

let encAlgo;
let algo = [];

algo[0] = (pass) => {

    return crypto.createHash("sha1").update(pass).digest('base64');
}

algo[1] = (pass) => {

    return crypto.createHash("md5").update(pass).digest('base64');
}

algo[2] = (pass) => {

    return crypto.createHash("sha256").update(pass).digest('base64');
}

algo[3] = (pass) => {

    let key = [];
    let dst = [];
    let i = 0;
    let nBytes = pass.length;

    while (i < nBytes) {

        i++;

        key[i] = pass.charCodeAt(i - 1);
        dst[i] = key[i];
    }

    for (let i = 1; i <= 16; i++) {

        if (!key[i])
            key[i] = 0;

        if (!dst[i])
            dst[i] = 0;
    }

    let rslt = key[1] + key[2] * 256 + key[3] * 65536 + key[4] * 16777216;
    let one = rslt * 213119 + 2529077;

    one = one - Math.floor(one / 4294967296) * 4294967296;
    rslt = key[5] + key[6] * 256 + key[7] * 65536 + key[8] * 16777216;

    let two = rslt * 213247 + 2529089;

    two = two - Math.floor(two / 4294967296) * 4294967296;
    rslt = key[9] + key[10] * 256 + key[11] * 65536 + key[12] * 16777216;

    let three = rslt * 213203 + 2529589;

    three = three - Math.floor(three / 4294967296) * 4294967296;
    rslt = key[13] + key[14] * 256 + key[15] * 65536 + key[16] * 16777216;

    let four = rslt * 213821 + 2529997;

    four = four - Math.floor(four / 4294967296) * 4294967296;

    key[1] = one & 0xFF;
    key[2] = (one >> 8) & 0xFF;
    key[3] = (one >> 16) & 0xFF;
    key[4] = (one >> 24) & 0xFF;
    key[5] = two & 0xFF;
    key[6] = (two >> 8) & 0xFF;
    key[7] = (two >> 16) & 0xFF;
    key[8] = (two >> 24) & 0xFF;
    key[9] = three & 0xFF;
    key[10] = (three >> 8) & 0xFF;
    key[11] = (three >> 16) & 0xFF;
    key[12] = (three >> 24) & 0xFF;
    key[13] = four & 0xFF;
    key[14] = (four >> 8) & 0xFF;
    key[15] = (four >> 16) & 0xFF;
    key[16] = (four >> 24) & 0xFF;
    dst[1] = dst[1] ^ key[1];

    i = 1;

    while (i < 16) {
        i++;

        dst[i] = dst[i] ^ dst[i - 1] ^ key[i];
    }

    i = 0;

    while (i < 16) {

        i++;
        if (dst[i] == 0)
            dst[i] = 102;
    }

    let encrypt = "0x";

    i = 0;

    while (i < 16) {

        i++;

        if (dst[i] < 16)
            encrypt = encrypt + "0" + dst[i].toString(16);
        else
            encrypt = encrypt + dst[i].toString(16);
    }

    return encrypt;
}

algo[4] = (pass) => {

    const EncryptMD5 = (originalPassword) => { return Array.from(crypto.createHash("md5").update(originalPassword).digest()).map((byte) => byte.toString(16).padStart(2, "0")).join(""); };
    const md5Password = Array.from(pass);

    let s = (EncryptMD5(pass) + EncryptMD5(pass)).split("");
    let j = 0;

    for (let i = 0; i < s.length; i++) {

        if (j >= pass.length)
            j = 0;

        const calcu = s[i].charCodeAt(0) ^ md5Password[j].charCodeAt(0);

        s[i] = String.fromCharCode(calcu);

        j++;
    }

    return EncryptMD5(s.join(""));
}

const validatePassword = (test, target) => {

    if (encAlgo == undefined) {

        for (let i = 0; i < algo.length; i++) {

            if (algo[i](test) == target) {

                encAlgo = i;

                return true;
            }
        }

        return false;

    }
    else {

        return (algo[encAlgo](test) == target)
    }
}

class Connector extends EventEmitter {

    #config;
    #remoteIPAddress;
    #serverConnections = class { this = []; }
    #serverTables = {}
    #serverReward = {}
    #serverInterval = {}

    constructor(config, remoteIPAddress) {

        super();

        this.#config = config;
        this.#remoteIPAddress = remoteIPAddress;
    }

    GET_HASH = () => {

        return crypto.createHash("sha256").update(this.#config["client"].password + this.#remoteIPAddress + this.#config["ls"].dbPort).digest("hex");
    }

    GET_ADDRESS = () => {

        return this.#config["client"].walletAddress;
    }

    CONNECT_SERVER = async (id) => {

        const config = {

            "database": this.#config[id].dbName,
            "host": ((id == "ls" || this.#config[id].dbIPAddress == this.#remoteIPAddress) ? ("127.0.0.1") : (this.#config[id].dbIPAddress)),
            "port": this.#config[id].dbPort,
            "user": this.#config[id].dbUsername,
            "password": this.#config[id].dbPassword,
            "waitForConnections": true,
            "connectionLimit": 25,
            "maxIdle": 6,
            "idleTimeout": 60000,
            "queueLimit": 0
        }

        try {

            let connection;

            this.#serverConnections[id] = mysql.createPool(config).promise();

            connection = await this.#serverConnections[id].getConnection();
            connection.on("error", () => {

                clearInterval(this.#serverInterval[id]);
                this.emit("updateServer", id, false);
            });

            this.#serverInterval[id] = setInterval(() => { connection.query("SELECT 1;"); }, 45000);
            this.emit("updateServer", id, true);
        }
        catch {

            this.emit("updateServer", id, false);
        }

        return await new Promise((resolve) => setTimeout(() => { resolve(true); }, 500));
    }

    DISCONNECT_SERVER = async (id) => {

        clearInterval(this.#serverInterval[id]);
        await this.#serverConnections[id].end();

        return true;
    }

    VALIDATE_SERVER = async (id) => {

        const connection = await this.#serverConnections[id].getConnection();

        let checks = 0;
        let result = false;

        try {

            if (id == "ls") {

                const accountsTable = (await connection.query("SHOW COLUMNS FROM accounts;"))[0];
                const gameserversTable = (await connection.query("SHOW COLUMNS FROM gameservers;"))[0];

                const lsConfig = this.#config["ls"].dbTableColumns;

                accountsTable.forEach((column) => {

                    if (column.Field == lsConfig.accounts.accountUsername || column.Field == lsConfig.accounts.accountPassword)
                        checks++;
                });

                gameserversTable.forEach((column) => {

                    if (column.Field == lsConfig.gameservers.gameserverId)
                        checks++
                });

                if (checks == 3) {

                    //await connection.query("SET autocommit = OFF;");
                    //await connection.query("START TRANSACTION;");
                    await connection.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) NOT NULL DEFAULT 'not linked';");
                    await connection.query("ALTER TABLE gameservers ADD COLUMN IF NOT EXISTS balance INT(10) UNSIGNED NOT NULL DEFAULT '0';");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_deposits (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_withdrawals (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_temporary (server_id INT(11) NOT NULL, character_id INT(10) NOT NULL, amount INT(10) UNSIGNED NOT NULL, refund INT(10) UNSIGNED NOT NULL, PRIMARY KEY(server_id, character_id, refund)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    //await connection.query("COMMIT;");

                    this.#serverTables["ls"] = lsConfig;

                    result = true;
                }
            }
            else {

                const charactersTable = (await connection.query("SHOW COLUMNS FROM characters;"))[0];
                const itemsTable = (await connection.query("SHOW COLUMNS FROM items;"))[0];

                const gsConfig = this.#config[id].dbTableColumns;

                charactersTable.forEach((column) => {

                    if (column.Field == gsConfig.characters.accountUsername || column.Field == gsConfig.characters.characterId || column.Field == gsConfig.characters.characterName)
                        checks++;
                });

                itemsTable.forEach((column) => {

                    if (column.Field == gsConfig.items.characterId || column.Field == gsConfig.items.itemId || column.Field == gsConfig.items.itemTypeId || column.Field == gsConfig.items.itemAmount)
                        checks++
                });

                if (checks == 7) {

                    this.#serverTables[id] = gsConfig;
                    this.#serverReward[id] = this.#config[id].rewardId;

                    result = true;
                }
            }
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_IDS = async () => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const id = this.#serverTables["ls"].gameservers.gameserverId;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + id + " FROM gameservers;"))[0];
            result = temporary.map(key => key[id])
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_TOTAL_CLIENT_BALANCE = async () => {

        const connection = await this.#serverConnections["ls"].getConnection();

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT SUM(balance) AS balance FROM gameservers;"))[0][0];

            result = (temporary.balance != null) ? (temporary.balance) : ("0");
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_ACCOUNTS = async (ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + accnm + " FROM accounts WHERE wallet_address = ?;", [ethAddress]))[0];
            result = temporary.map(key => key[accnm]);
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    ADD_ACCOUNT = async (username, password, ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;
        const psw = this.#serverTables["ls"].accounts.accountPassword;

        let result = false;
        let commit = true;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + psw + " FROM accounts WHERE " + accnm + " = ?", [username]))[0][0];

            if (validatePassword(password, temporary[psw])) {

                await connection.query("SET autocommit = 0;");
                await connection.query("START TRANSACTION;");

                temporary = (await connection.query("UPDATE accounts SET wallet_address = ? WHERE " + accnm + " = ? AND wallet_address = 'not linked' AND " + psw + " = ?;", [ethAddress, username, temporary[psw]]))[0];
                result = (temporary.changedRows == 1)
            }
        }
        catch (error) {

            commit = false;
            result = false;

            await connection.query("ROLLBACK;");

            this.emit("error", error);
        }
        finally {

            if (commit === true)
                await connection.query("COMMIT;");

            connection.release();
            return result;
        }
    }

    REMOVE_ACCOUNT = async (username, password, ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;
        const psw = this.#serverTables["ls"].accounts.accountPassword;

        let result = false;
        let commit = true;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + psw + " FROM accounts WHERE " + accnm + " = ?", [username]))[0][0];

            if (validatePassword(password, temporary[psw])) {

                await connection.query("SET autocommit = 0;");
                await connection.query("START TRANSACTION;");

                temporary = (await connection.query("UPDATE accounts SET wallet_address = 'not linked' WHERE " + accnm + " = ? AND wallet_address = ? AND " + psw + " = ?;", [username, ethAddress, temporary[psw]]))[0];
                result = (temporary.changedRows == 1)
            }
        }
        catch (error) {

            commit = false;
            result = false;

            await connection.query("ROLLBACK;");

            this.emit("error", error);
        }
        finally {

            if (commit === true)
                await connection.query("COMMIT;");

            connection.release();
            return result;
        }
    }

    GET_CHARACTERS = async (id, username) => {

        const connection = await this.#serverConnections[id].getConnection();
        const accnm = this.#serverTables[id].characters.accountUsername;
        const chnm = this.#serverTables[id].characters.characterName;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + chnm + " FROM characters WHERE " + accnm + " = ?;", [username]))[0];
            result = temporary.map(key => key[chnm]);
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_CHARACTER_BALANCE = async (id, charname) => {

        const connection = await this.#serverConnections[id].getConnection();
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT SUM(i." + iitam + ") AS balance FROM items AS i, characters AS c WHERE c." + cchid + " = i." + ichid + " AND c." + cchnm + " = ? AND i." + iitmtyid + " = ? AND i.loc = 'inventory';", [charname, this.#serverReward[id]]))[0][0];
            result = (temporary.balance != null) ? (temporary.balance) : ("0");
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    UPDATE_GAMESERVER_BALANCE = async (id) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;
        const srvid = this.#serverTables["ls"].gameservers.gameserverId;

        let result = false;
        let commit = true;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT SUM(" + iitam + ") AS balance FROM items WHERE  " + iitmtyid + " = ? AND loc = 'inventory';", [this.#serverReward[id]]))[0][0];
            temporary = (temporary.balance != null) ? (temporary.balance) : ("0");

            temporary = (await connectionLS.query("UPDATE gameservers SET balance = ? WHERE " + srvid + " = ?;", [temporary, id]))[0];
            result = (temporary.changedRows == 1)
        }
        catch (error) {

            commit = false;
            result = false;

            await connectionLS.query("ROLLBACK;");
            await connectionGS.query("ROLLBACK;");

            this.emit("error", error);
        }
        finally {

            if (commit === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }

            connectionLS.release();
            connectionGS.release();
            return result;
        }
    }

    LOG_DEPOSIT = async (txHash, from, amount, id, character) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId
        const iid = this.#serverTables[id].items.itemId;;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let commit = true;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT " + cchid + " FROM characters WHERE  " + cchnm + " = ?;", [character]))[0][0];
            temporary = temporary[cchid];

            let charID = temporary;

            temporary = (await connectionGS.query("SELECT " + iitam + " FROM items WHERE  " + iitmtyid + " = ? AND loc = 'inventory' AND " + ichid + " = ? LIMIT 1;", [this.#serverReward[id], charID]))[0];

            if (temporary.length == 1) {

                temporary = (await connectionGS.query("UPDATE items SET " + iitam + " = " + iitam + " + ? WHERE " + ichid + " = ? AND " + iitmtyid + " = ? AND `loc` = 'inventory' LIMIT 1;", [amount, charID, this.#serverReward[id]]))[0];
                result = (temporary.changedRows == 1);
            }
            else {

                let testID = Math.floor(Math.random() * 2147483646);

                do {

                    testID++;
                    temporary = (await connectionGS.query("SELECT COUNT(" + iid + ") AS instances FROM items WHERE " + iid + " = ?;", [testID]))[0][0];

                } while (temporary.instances > 0)

                temporary = (await connectionGS.query("INSERT INTO items (" + ichid + ", " + iid + ", " + iitmtyid + ", " + iitam + ", loc) VALUES (?, ?, ?, ?, 'inventory');", [charID, testID, this.#serverReward[id], amount]))[0];
                result = (temporary.affectedRows == 1);
            }

            if (result == true)
                await connectionLS.query("INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);", [id, txHash, character, from, amount]);
        }
        catch (error) {

            commit = false;
            result = false;

            await connectionLS.query("ROLLBACK;");
            await connectionGS.query("ROLLBACK;");

            this.emit("error", error);
        }
        finally {

            if (commit === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }

            connectionLS.release();
            connectionGS.release();
            return result;
        }
    }

    /*
    

 
ADD_REFUND_AND_DECREASE_BALANCE = async (serverid, character, amount, address, refund) => {
 
    return await new Promise((resolve, reject) => {
  
        this.#gameServer.query("SELECT account_name, obj_Id FROM characters WHERE char_name = ?", [character], async (error, result) => {
 
            if (error)
                return reject(error);
 
            if (!(result && result.length == 1))
                return resolve(false);
 
            let ethAddress = await new Promise((res) => {
 
                this.#loginServer.query("SELECT ethAddress FROM accounts WHERE login = ? AND ethAddress REGEXP '^0x[a-fA-F0-9]{40}$'", [result[0].account_name], (e, r) => {
 
                    if (e)
                        return res({ "error": e });
 
                    if (r && r.length == 1)
                        return res(r[0].ethAddress);
 
                    return res(false);
                });
            });
 
            if (ethAddress.error)
                return reject(ethAddress.error);
 
            if (ethAddress === false || ethAddress != address)
                return resolve(false);
 
            data = await new Promise((res) => {
 
                if (data == amount) {
 
                    this.#gameServer.query("DELETE FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#reward], (e) => {
 
                        if (e)
                            return res({ "error": e });
 
                        return res(true);
                    });
                }
                else if (data > amount) {
 
                    this.#gameServer.query("UPDATE `items` SET `count` = `count` - ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [amount, result[0].obj_Id, this.#reward], (e) => {
 
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
 
                this.#loginServer.query("INSERT INTO `fiskpay_temporary` (`server_id`, `owner`, `item`, `amount`, `refund`) VALUES (?, ?, ?, ?, ?)", [serverid, result[0].obj_Id, this.#reward, amount, refund], (e, r) => {
 
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
 
                this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[0].obj_Id, this.#reward], (e, r) => {
 
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
 
                    this.#gameServer.query("INSERT INTO `items` (`owner_id`, `object_id`, `item_id`, `count`, `loc`) VALUES (?, ?, ?, ?, 'inventory')", [result[0].obj_Id, objID, this.#reward, amount], (e) => {
 
                        if (e)
                            return res({ "error": e })
 
                        return res(true);
                    });
                }
                else {
 
                    this.#gameServer.query("UPDATE `items` SET `count` = `count` + ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [amount, result[0].obj_Id, this.#reward], (e) => {
 
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
 
                this.#loginServer.query("DELETE FROM `fiskpay_temporary` WHERE `server_id` = ? AND `owner` = ? AND item = ? AND `amount` = ? AND `refund` = ?", [serverid, result[0].obj_Id, this.#reward, amount, refund], (e) => {
 
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
 
        this.#loginServer.query("INSERT INTO `fiskpay_deposits` (`txHash`, `server_id`, `character`, `from`, `symbol`, `amount`) VALUES (?, ?, ?, ?, ?, ?)", [txHash, serverid, character, from, symbol, amount], (error) => {
 
            if (error)
                return reject(error);
 
            return resolve(true);
        });
    });
}
 
LOG_WITHDRAWAL = async (txHash, serverid, character, to, symbol, amount) => {
 
    return await new Promise((resolve) => {
 
        this.#loginServer.query("INSERT INTO `fiskpay_withdrawals` (`txHash`, `server_id`, `character`, `to`, `symbol`, `amount`) VALUES (?, ?, ?, ?, ?, ?)", [txHash, serverid, character, to, symbol, amount], (error) => {
 
            if (error)
                return reject(error);
 
            return resolve(true);
        });
    });
}
 
REFUND_EXPIRED = async () => {
 
    const now = Math.floor(Date.now() / 1000);
 
    let expiredTxs = await this.#gameServer.query("SELECT owner, amount, refund FROM fiskpay_temporary WHERE item = ? AND refund < ? ", [this.#reward, now]);
 
    // this.#loginServer.query("INSERT INTO `fiskpay_balances` (`server_id`, `balance`, `nChars`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `balance` = ?, `nChars` = ?", [serverid, balance, nChars, balance, nChars]
 
    expiredTxs[0].forEach(row => {
 
        console.log(row.owner + " " + row.amount);
    });
 
    return true;
    
    return await new Promise((resolve, reject) => {
 
        this.#loginServer.query("SELECT `owner`, `amount`, `refund` FROM `fiskpay_temporary` WHERE `server_id` = ? AND `item` = ? AND `refund` < ? ", [serverid, this.#reward, now], async (error, result) => {
 
            if (error)
                return reject(error);
 
            const nResult = result.length;
 
            let data;
 
            for (let i = 0; i < nResult; i++) {
 
                data = await new Promise((res) => {
 
                    this.#gameServer.query("SELECT `count` FROM `items` WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[i].owner, this.#reward], (e, r) => {
 
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
 
                        this.#gameServer.query("INSERT INTO `items` (`owner_id`, `object_id`, `item_id`, `count`, `loc`) VALUES (?, ?, ?, ?, 'inventory')", [result[i].owner, objID, this.#reward, result[i].amount], (e) => {
 
                            if (e)
                                return res({ "error": e })
 
                            return res(true);
                        });
                    }
                    else {
 
                        this.#gameServer.query("UPDATE `items` SET `count` = `count` + ? WHERE `owner_id` = ? AND item_id = ? AND `loc` = 'inventory'", [result[i].amount, result[i].owner, this.#reward], (e) => {
 
                            if (e)
                                return res({ "error": e })
 
                            return res(true);
                        });
                    }
                });
 
                if (data.error)
                    return reject(data.error);
 
                data = await new Promise((res) => {
 
                    this.#loginServer.query("DELETE FROM `fiskpay_temporary` WHERE `server_id` = ? AND `owner` = ? AND item = ? AND `amount` = ? AND `refund` = ?", [serverid, result[i].owner, this.#reward, result[i].amount, result[i].refund], (e) => {
 
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
 
        this.#loginServer.query("SELECT SUM(`balance`) AS balance, SUM(`nChars`) AS nChars FROM `fiskpay_balances`", async (error, result) => {
 
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
 
                    this.#loginServer.query("INSERT INTO `fiskpay_balances` (`server_id`, `balance`, `nChars`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `balance` = ?, `nChars` = ?", [serverid, balance, nChars, balance, nChars], (e) => {
 
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
*/
}

module.exports = Connector;