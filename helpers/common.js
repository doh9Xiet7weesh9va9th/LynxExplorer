var co = require('co');
var _ = require('lodash');
var axios = require('axios');
var { db } = require('./db');
var lib = require('./lib');
var bitcoin = require('./bitcoin');
var markets = require('./markets');
var settings = require('../lib/settings');

const updateDb = function(coin){
    return new Promise(function (resolve,reject) {
        co(function* () {
            let stats = yield db.coinStats.getCoinStats();
            if(stats){                
                let count = yield bitcoin.getBlockCount();   
                let supply = yield bitcoin.getSupply();
                let connections = yield bitcoin.getConnections();
                yield db.coinStats.update({
                    coin,
                    count,
                    supply,
                    connections
                });
                stats = yield db.coinStats.getCoinStats();                
            }
            resolve(stats);
        }).catch(reject);
    });
}

const updateTxnsDb =(start,end)=>{
    return new Promise(function (resolve,reject) {
        co(function* () {
            let errorCount = 0; 
            let isAllUpdated = false;                
            for(let height = start; height <= end; height++){                                    
                let blockHash = yield bitcoin.getBlockHash(height);                             
                if(blockHash !== bitcoin.CONSOLE_ERROR){                    
                    let block = yield bitcoin.getBlockByHash(blockHash);                    
                    if(block !== bitcoin.CONSOLE_ERROR){                                                              
                        let txLength = block.tx.length;
                        for(let i=0; i < txLength; i++){                            
                            let txnId = block.tx[i];
                            let tx = yield db.tx.findOne(txnId);                            
                            if(tx===null){
                                console.log(`${height} -- ${i}/${txLength} : ${txnId}`);
                                yield saveTx(txnId, block);
                            }
                        }
                    }
                }else{
                    console.log(height+':error');
                    errorCount++;
                    break;
                }                               
                if (height % 5 === 0) {
                    isAllUpdated = (height === end);
                    yield db.coinStats.update({
                        last: height                       
                    });
                    console.log(`${height}/${end} completed`);
                } 
            }
            if(errorCount === 0 && !isAllUpdated){
                console.log(`${end}/${end} completed`);
                yield db.coinStats.update({
                    last: end
                });
            }
            let stats = yield db.coinStats.getCoinStats();       
            resolve(stats);
        }).catch(reject);
    });
};

const updateHeavy =(height, count)=>{
    return new Promise(function (resolve,reject) {
        co(function* () {
            var votes = [];
            let cap = yield bitcoin.getMaxMoney();
            let maxvote = yield bitcoin.getMaxVote();
            let lvote = yield bitcoin.getVote();
            let phase = yield bitcoin.getPhase();
            let reward = yield bitcoin.getReward();
            let supply = yield bitcoin.getSupply();
            let estnext = yield bitcoin.getEstNext();
            let nextin = yield bitcoin.getNextIn();

            for(let index=0; index < count; index++){
                let hash = yield bitcoin.getBlockHash(height-index);
                let block = yield bitcoin.getBlockHash(hash);
                votes.push({
                    count:height-index,
                    reward:block.reward,
                    vote:block.vote
                });
            }
            let heavy = yield db.heavy.update({
                lvote,
                reward,
                supply,
                cap,
                estnext,
                phase: phase,
                maxvote,
                nextin,
                votes,
            });
            resolve(heavy);
        }).catch(reject);
    });
};

const updateMarketsDb =(market)=>{
    return new Promise(function (resolve,reject) {
        co(function* () {            
            let data = yield markets.getMarketData(market);
            if(data){
                yield db.markets.update(market,{
                    chartdata: JSON.stringify(data.chartdata),
                    buys: data.buys,
                    sells: data.sells,
                    history: data.trades,
                    summary: data.stats
                });
                if (market == settings.markets.default ) {
                    yield db.coinStats.update({
                        last_price: data.stats.last
                    });                    
                }
            }
            resolve();
        }).catch(reject);
    });
};

const saveTx = (hash, block)=>{
    return new Promise((resolve,reject)=>{
        co(function* (){
            let tx = yield bitcoin.getRawTransaction(hash);
            if(tx === bitcoin.CONSOLE_ERROR){
                resolve();
            }else{          
                let vin = yield lib.prepare_vin(tx);
                let { vout, nvin } = yield lib.prepare_vout(tx.vout, hash, vin);
                //update vin address
                let vinAddresses = yield nvin.map(p => updateAddress(p.addresses, hash, p.amount, 'vin'));
                //update vout address
                let voutAddresses = yield vout.map(p => updateAddress(p.addresses, hash, p.amount, 'vout'));
                //calculate total
                let total = vout.reduce((acc, p) => acc + p.amount, 0);
                let newTx = yield db.tx.save({
                    txid: tx.txid,
                    vin: nvin,
                    vout: vout,
                    total: total.toFixed(8),
                    timestamp: tx.time,
                    blockhash: tx.blockhash,
                    blockindex: block.height
                });
                resolve(newTx);
            }            
        }).catch(reject);
    });
};

const updateAddress = (hash, txid, amount,type)=>{
    return new Promise((resolve,reject)=>{
        co(function* (){
            let address = yield db.address.findOne(hash);
            if(address){
                if (hash == 'coinbase') {
                    address = yield db.address.update(hash,{
                        sent: address.sent + amount,
                        balance: 0
                    });                    
                }else{
                    let tx_array = address.txs;
                    var received = address.received;
                    var sent = address.sent;
                    if (type == 'vin') {
                        sent = sent + amount;
                    } else {
                        received = received + amount;
                    }          
                    let index = address.txs.findIndex(p=> p.address === txid);
                    //push to array
                    if(index===-1){                    
                        tx_array.push({addresses: txid, type: type});
                        if ( tx_array.length > settings.txcount ) {
                            tx_array.shift();
                        }
                        address = yield db.address.update(hash,{
                            txs: tx_array,
                            received: received,
                            sent: sent,
                            balance: received - sent
                        });
                    }else if(index>-1 && type !== tx_array[index].type){
                        address = yield db.address.update(hash,{
                            txs: tx_array,
                            received: received,
                            sent: sent,
                            balance: received - sent
                        });
                    }
                }
                resolve(address);
            }else{
                if(type==='vin'){
                    address = yield db.address.save({
                        a_id: hash,
                        txs: [ { addresses: txid, type } ],
                        sent: amount,
                        balance: amount,
                    });
                }else{
                    address = yield db.address.save({
                        a_id: hash,
                        txs: [ {addresses: txid, type: 'vout'} ],
                        received: amount,
                        balance: amount,
                    });
                }
                resolve(address);
            }
        }).catch(reject);
    });
};

const getDistribution = ({ richlist, stats }) => {
    
    let supply = stats.supply;
    let data = {
        supply,
        top_1_25 : {
            percent : 0,
            total : 0,
            bgColor : '#ff6384',
            label : 'Top 1-25'
        },
        top_26_50 : {
            percent : 0,
            total : 0,
            bgColor : '#8bc34a',
            label : 'Top 26-50'
        },
        top_51_75 : {
            percent : 0,
            total : 0,
            bgColor : '#36a2eb',
            label : 'Top 51-75'
        },
        top_76_100 : {
            percent : 0,
            total : 0,
            bgColor : '#607d8b',
            label : 'Top 76-100'
        },
        top_100_plus : {
            percent : 0,
            total : 0,
            bgColor : '#9e9e9e',
            label : 'unredeemed'
        }
    };
    let { top_1_25, top_26_50, top_51_75, top_76_100, top_100_plus } = data;

    let length = richlist.balance.length;
    for(let index=0; index<length; index++){
        let count = index + 1;
        let percentage = richlist.balance[index].balance / 100000000 / stats.supply * 100;
        if (count <= 25) {
            top_1_25.percent = top_1_25.percent + percentage;
            top_1_25.total = top_1_25.total + richlist.balance[index].balance / 100000000;
        }
        if (count <= 50 && count > 25) {
            top_26_50.percent = top_26_50.percent + percentage;
            top_26_50.total = top_26_50.total + richlist.balance[index].balance / 100000000;
        }
        if (count <= 75 && count > 50) {
            top_51_75.percent = top_51_75.percent + percentage;
            top_51_75.total = top_51_75.total + richlist.balance[index].balance / 100000000;
        }
        if (count <= 100 && count > 75) {
            top_76_100.percent = top_76_100.percent + percentage;
            top_76_100.total = top_76_100.total + richlist.balance[index].balance / 100000000;
        }
    }

    top_100_plus.percent = parseFloat(100 - top_76_100.percent - top_51_75.percent - top_26_50.percent - top_1_25.percent).toFixed(2);
    top_100_plus.total = parseFloat(supply - top_76_100.total - top_51_75.total - top_26_50.total - top_1_25.total ).toFixed(8);
    top_1_25.percent = parseFloat(top_1_25.percent).toFixed(2);
    top_1_25.total = parseFloat(top_1_25.total).toFixed(8);
    top_26_50.percent = parseFloat(top_26_50.percent).toFixed(2);
    top_26_50.total = parseFloat(top_26_50.total).toFixed(8);
    top_51_75.percent = parseFloat(top_51_75.percent).toFixed(2);
    top_51_75.total = parseFloat(top_51_75.total).toFixed(8);
    top_76_100.percent = parseFloat(top_76_100.percent).toFixed(2);
    top_76_100.total = parseFloat(top_76_100.total).toFixed(8);

    return data;
};

//Access key is registered by using aruljothiparthiban@hotmail.com
const getCountry = (ip) => {
    return new Promise(function (resolve, reject) {
        axios.get('http://api.ipstack.com/' + ip + '?access_key=d780842f33f35918a6c18fad711b1811')
            .then(function (res) {
                resolve(res.data);
            })
            .catch(reject);
    });
};


const getCountryName = (ip)=> {
    return new Promise(function (resolve,reject) {
        co(function* () {            
            let result = yield db.ipDetails.findOne(ip);
            if(result){
                resolve(result.country_name);
            } else{
                let country = yield getCountry(ip);
                if(country && country.country_name){
                    yield db.ipDetails.save(country);
                    resolve(country.country_name);
                }else{
                    console.log(ip,country);                   
                    resolve(null);
                }                
            }
            resolve();
        }).catch(reject);
    });
};

const getBlocksToUpdate = function(items){
    let blocks = [];    
    items = _.chain(items).groupBy('blockindex').value();
    for (let key in items) {
        if(items[key].length>0){
            let item = items[key][0];
            let model = {
                blockhash : item.blockhash,
                blockindex : item.blockindex,
                timestamp : item.timestamp,
                blockTime : '',
                transactions : items[key].length
            };        
            model.minorRewardAddress = item.vout[0].addresses;
            blocks.push(model);
        }
    }
    return blocks;
};

const updateBlocks = function(){
    return new Promise(function (resolve,reject) {
        co(function* () {            
            let stats = yield db.coinStats.getCoinStats();
            let block = yield db.block.getRecentBlock();
            let startIndex = 0;
            let endIndex = 0;        
            if(block){
                startIndex = block.blockindex;
            }
            if(stats){
                endIndex = stats.last;
            }
            if(endIndex - startIndex > 0){
                // update block                
                let step = 100;               
                while(endIndex - (startIndex + step) > 0){
                    console.log(`update blocks between ${startIndex} - ${startIndex + step }`);
                    let items = yield db.tx.getTransactions(startIndex, startIndex + step);
                    let blocksToInsert = getBlocksToUpdate(items);
                    if(blocksToInsert.length>0){
                        blocksToInsert = yield db.block.getBlockHashListToInsert(blocksToInsert);
                        yield db.block.insertMany(blocksToInsert);    
                    }
                    startIndex += step;
                }
                if(endIndex - startIndex > 0){                    
                    console.log(`update blocks between ${startIndex} - ${endIndex}`);                   
                    let items = yield db.tx.getTransactions(startIndex, endIndex);  
                    let blocksToInsert = getBlocksToUpdate(items);
                    if(blocksToInsert.length>0){
                        blocksToInsert = yield db.block.getBlockHashListToInsert(blocksToInsert);
                        yield db.block.insertMany(blocksToInsert);    
                    }             
                }
            }
            resolve(true);
        }).catch(reject);
    });
}

module.exports.updateDb = updateDb;
module.exports.updateTxnsDb = updateTxnsDb;
module.exports.updateHeavy = updateHeavy;
module.exports.updateMarketsDb = updateMarketsDb;
module.exports.saveTx = saveTx;
module.exports.getDistribution = getDistribution;
module.exports.getCountryName = getCountryName;
module.exports.updateBlocks = updateBlocks;
