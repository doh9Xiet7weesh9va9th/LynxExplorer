var { display, movement, address, api, richlist, markets,
    genesis_tx, genesis_block, txcount } = require('../lib/settings');
var repository = require('../data-access/richlist.repository');
var marketsRepository = require('../data-access/markets.repository');
var searchRepository = require('../data-access/search.repository');

exports.index = (req,res) =>{
    res.render('index', { 
        active: 'home', 
        error: null, 
        warning: null
    });
};

exports.network = (req,res) =>{
    res.render('network', {
        active: 'network'
    });
};

exports.movement = (req,res) =>{
    res.render('movement', {
        active: 'movement', 
        flaga: movement.low_flag, 
        flagb: movement.high_flag, 
        min_amount: movement.min_amount
    });
};

exports.info = (req,res) =>{
    res.render('info', { 
        active: 'info', 
        address: address, 
        hashes: api
    });
};

exports.richList = (req,res) =>{
    if (display.richlist){
        console.time(req.originalUrl);
        repository.getData().then(data=>{
            console.timeEnd(req.originalUrl);
            let { richlist:{ balance, received }, distribution:{ t_1_25, t_26_50, t_51_75, t_76_100, t_101plus  }, stats } = data;
            res.render('richlist', {
                active: 'richlist',
                balance: balance,
                received: received,
                stats: stats,
                dista: t_1_25,
                distb: t_26_50,
                distc: t_51_75,
                distd: t_76_100,
                diste: t_101plus,
                show_dist: richlist.distribution,
                show_received: richlist.received,
                show_balance: richlist.balance,
              });
        }).catch(err=>{
            console.log('err',err);
            res.redirect('/');
        });
    }else{
        res.redirect('/');
    }
};

exports.market = (req,res) =>{
    let { market } = req.params;
    if (markets.enabled.indexOf(market) != -1) {
        console.time(req.originalUrl);
        marketsRepository.getMarkets(market).then(data=>{
            console.timeEnd(req.originalUrl);            
            res.render('./markets/' + market, {
                active: 'markets',
                marketdata: {
                  coin: markets.coin,
                  exchange: markets.exchange,
                  data: data,
                },
                market: market
            });
        }).catch(err=>{
            res.redirect('/');
        });
    }else{
        res.redirect('/');
    }
};

const searchAddress = (req,res)=>{
    let { search } = req.body;
    searchRepository.getAddress(search).then(address=>{
        if (address) {
            res.redirect('/address/' + address.a_id);
        } else {
            searchRepository.getBlockHash(search).then(hash=>{
                if (hash != 'There was an error. Check your console.') {
                    res.redirect('/block/' + hash);
                } else {
                    res.render('index', {
                        active: 'home', 
                        error: null, 
                        warning: null
                    });
                }
            });
        }
    }).catch(err=>{
        console.log('err',err);
        res.redirect('/');
    });
};

exports.search = (req,res) =>{
    let { search } = req.body;
    if(search.length === 64){
        if(search === genesis_tx) {
            res.redirect('/block/' + genesis_block);
        }else{            
            searchRepository.findTransactionById(search).then(txn=>{
                if(txn){
                    res.redirect('/tx/' +txn.txid);
                }else{
                    searchRepository.getBlockHash(search).then(hash=>{
                        if (hash != 'There was an error. Check your console.') {
                            res.redirect('/block/' + hash);
                        } else {
                            res.render('index', {
                                active: 'home', 
                                error: locale.ex_search_error, 
                                warning: null
                            });
                        }
                    });
                }
            });
        }
    }else{
        searchAddress(req,res);
    }
};

exports.address = (req,res) =>{
    let hash = req.param('hash');
    let count = req.param('count') || txcount;
    searchRepository.getAddressAndTxns(hash,count).then(data=>{
        data.active = 'address';
        res.render('address', data);
    }).catch(err=>{
        res.render('index', {
            active: 'home', 
            error: err.message, 
            warning: null
        });
    });
};