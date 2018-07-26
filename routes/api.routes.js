var express = require('express');
var controller = require('../controllers/api.controller');

const router = express.Router();

router.get('/address/:hash/:count?', controller.address);
router.get('/richlist', controller.richList);

module.exports = router;