const crypto = require("node:crypto");

const one = (pass) => {

    return crypto.createHash("sha1").update(pass).digest('base64');
}

const two = (pass) => {

    return crypto.createHash("md5").update(pass).digest('base64');
}

const three = (pass) => {

    return crypto.createHash("sha256").update(pass).digest('base64');
}

const four = (pass) => {

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

const five = (pass) => {

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

module.exports = { one, two, three, four, five };