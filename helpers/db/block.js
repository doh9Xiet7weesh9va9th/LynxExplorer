var Block = require('../../models/block');
var moment = require('moment');

exports.getRecentBlock = ()=>{    
    return new Promise((resolve,reject)=>{
        Block
        .find({})
        .sort({ blockindex : 'desc' })        
        .limit(1)
        .lean(true)
        .exec(function(err, items) {
            if(err){
                reject(err);
            }else {      
                resolve(items[0] || null);
            }
        });
    });    
};

exports.insertMany = (blocks)=>{
    return new Promise((resolve,reject)=>{
        Block.insertMany(blocks, function(err,items){
            if(err){
                reject(err);
            }else {      
                resolve(items);
            }
        });
    });  
};

exports.getRecentBlocks = (pageIndex, pageSize)=>{        
    return new Promise((resolve,reject)=>{
        Block
        .find({})
        .sort({ blockindex: 'desc' })
        .skip((pageSize * pageIndex) - pageSize)
        .limit(pageSize+1)
        .lean(true)
        .exec(function(err, items) {
            if(err) reject(err);
            else {
                let length = items.length;
                for (let index = 0; index < length; index++) {
                    if ((index + 1) < length) {
                        let currentDate = new Date((items[index].timestamp) * 1000);
                        let previousDate = new Date((items[index + 1].timestamp) * 1000);
                        let duration = moment.duration(moment(currentDate).diff(moment(previousDate)));

                        let blockTime = '';
                        let hours = duration.asHours();
                        let minutes = duration.asMinutes();
                        let seconds = duration.asSeconds();
                        if (seconds < 60) {
                            blockTime = seconds + ' secs';
                        } else {
                            if (minutes < 60) {
                                blockTime = Math.floor(minutes);
                                blockTime += blockTime > 1 ? ' mins' : ' min';
                            } else {
                                blockTime = Math.floor(hours);
                                blockTime += blockTime > 1 ? ' hours' : ' hour';
                            }
                        }
                        items[index].blockTime = blockTime;
                    } else {
                        items[index].blockTime = '20 secs';
                    }
                }
                if (items.length > pageSize) {
                    items.pop();
                }
                resolve(items);
            }
        });
    });    
};

exports.getRecentBlocksCount = ()=>{    
    return new Promise((resolve,reject)=>{
        Block.count({}).exec(function(err, count) {
            if(err) reject(err);
            else resolve(count);
        });
    });
};