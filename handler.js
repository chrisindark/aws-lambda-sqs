// dependencies
var async     = require('async')
    , AWS     = require('aws-sdk')
    , fs      = require('fs')
    , util    = require('util')
    , Promise = require('promise')
    , config  = require('config');

// constants
var MAX_WIDTH  = 100
  , MAX_HEIGHT = 100;

AWS.config.loadFromPath('./config/aws.sqs.config.json');
var SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
var Lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

var queueUrl = null;
// var funcName = null;
 
module.exports.handler = function(event, context) {
  function getQueueUrl () {
    var queueParams = {
      QueueName: 'test_queue'
    };

    SQS
      .getQueueUrl(queueParams)
      .promise()
      .then(function (data) {
        console.log("Success", data.QueueUrl);
        queueUrl = data.QueueUrl;
        getMessages(queueUrl);
      })
      .catch(function (err) {
        console.log("Error", err);
      });
  }

  function getMessages(queueUrl) {
    var messageParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 6,
      WaitTimeSeconds: 20
    };

    SQS
      .receiveMessage(messageParams)
      .promise()
      .then(function (res) {
        if (res.Messages) {
          return Promise.all(res.Messages.map(processMessage));
        } else {
          console.log('');
        }
      })
      // handle any errors and restore the chain so we always get
      // to the next step -  which is to recurse
      .catch(function (err) {
        console.log(err, err.stack);
      })
      .then(function () {
        recurseSqsQueue();
      })
      .then(function () {
        context.succeed();
      })
      // only fail the function if we couldn't recurse, which we
      // can only monitor via cloudwatch and trigger
      .catch(function (err) {
        context.fail(err, err.stack);
      });
  }

  getQueueUrl();

};

function processMessage (msg) {
  console.log('Message Body ' + msg.Body);
  var deleteMessageParams = {
    QueueUrl: queueUrl,
    ReceiptHandle: msg.ReceiptHandle
  };

  return SQS
    .deleteMessage(deleteMessageParams)
    .promise()
    .then(function () {
      console.log('MessageId ' + msg.MessageId + ' deleted');
    })
    .catch(function (err) {
      console.log('MessageId ' + msg.MessageId, err, err.stack);
    })
}

function recurseSqsQueue() {
  var lambda = require('./handler.js');
  var context = require('./context.js');
  var event = require('./event.js');
  var thisEvent = new event();
  var thisContext = new context();

  lambda.handler(thisEvent, thisContext)
    .promise()
    .then(function (data) {
      console.log("Recursed");
    });

  // var params = {
  //   FunctionName: funcName,
  //   InvokeArgs: "{}"
  // };

  // return Lambda
  //   .invokeAsync(params)
  //   .promise()
  //   .then(function (data) {
  //     console.log("Recursed");
  //   });
}
