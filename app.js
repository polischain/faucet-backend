const express = require('express');
const path = require("path");
const {verify} = require('hcaptcha');
const cors = require('cors')

const Web3 = require("web3");
const NodeCache = require("node-cache")

const cache = new NodeCache();
const cache_time = 60 * 60 * 24;


const PORT = process.env.PORT || 8080;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SECRET = process.env.CAPTCHA_SECRET;

const web3_testnet = new Web3("https://sparta-rpc.polis.tech")
const web3_mainnet = new Web3("https://rpc.polis.tech")

const account = web3_testnet.eth.accounts.privateKeyToAccount("0x" + PRIVATE_KEY)
web3_testnet.eth.accounts.wallet.add(account)
web3_testnet.defaultAccount = account.address;

web3_mainnet.eth.accounts.wallet.add(account)
web3_mainnet.defaultAccount = account.address;

const app = express();
app.use(express.json());
app.use(cors())

app.get("/", async (req, res) => {
    res.sendFile(path.join(__dirname,'./landing.html'))
})

app.post('/', async (req, res) => {
    let body = req.body;
    let data = { network: body.network, address: Web3.utils.toChecksumAddress(body.address), token: body.verify}
    if (!data.token) {
        res.json({error: "No captcha token for verification"})
        return
    }
    if (!data.network || data.network !== "mainnet" && data.network !== "testnet") {
        res.json({error: "Wrong network specified, please use mainnet or testnet"})
        return
    }

    if (!data.address || !Web3.utils.isAddress(data.address)) {
        res.json({error: "Wrong address. Please make sure you included the address and it is correctly formatted"})
        return
    }

    try {
        const tokenVerify = await verify(SECRET, data.token)
        if (tokenVerify.success) {

            console.log("Coin request received for", data.network)

            let cached = cache.get(data.address)
            if (!cached) {
                let success = cache.set(data.address, Date.now(), cache_time);
                if (success) {
                    switch (data.network) {
                        case "mainnet":
                            let txMainNet = await web3_mainnet.eth.sendTransaction({
                                from: account.address,
                                to: data.address,
                                value: Web3.utils.toWei("0.001", "ether"),
                                gas: "21000",
                                gasPrice: Web3.utils.toWei("1", "gwei")
                            })
                            res.json({data: txMainNet.transactionHash})
                            return
                        case "testnet":
                            let txTestNet = await web3_testnet.eth.sendTransaction({
                                from: account.address,
                                to: data.address,
                                value: Web3.utils.toWei("10", "ether"),
                                gas: "21000",
                                gasPrice: Web3.utils.toWei("1", "gwei")
                            })
                            res.json({data: txTestNet.transactionHash})
                            return
                    }
                } else {
                    res.json({error: "Internal Error"})
                }
            } else {
                console.log("Address already received coins within period, ignoring...")
                let timestamp_release = cached + (cache_time * 1000);
                let timestamp_now = Date.now();
                let remaining = ((timestamp_release - timestamp_now) / 1000).toFixed(0);
                res.json({error: "Already received coins, wait " + secondsRender(remaining)})
            }
        } else {
            res.json({error: "Invalid token"})
        }
    } catch (e) {
        res.json({error: "Verification failed for an internal error"})
    }

});

app.listen(PORT, () => {
    console.log(`Express listening on port:${PORT}`);
});

function secondsRender(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);
    let hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    let mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    let sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
}
