(function (exports, require, module, __filename, __dirname) { var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var watson = require('watson-developer-cloud');
var app = express();

var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var url = 'mongodb://ec2-54-232-209-183.sa-east-1.compute.amazonaws.com/mockingbird';

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

var conversation_id = "";
var w_conversation = watson.conversation({
    url: 'https://gateway.watsonplatform.net/conversation/api',
    username: process.env.CONVERSATION_USERNAME || '6bc399a7-7271-4359-a59c-ccf126438e57',
    password: process.env.CONVERSATION_PASSWORD || 'FQUpn2DjMee8',
    version: 'v1',
    version_date: '2016-07-11'
});
var workspace = process.env.WORKSPACE_ID || '';

app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'TokenWorkChatTPT') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Erro de validação no token.');
});

app.post('/webhook/', function (req, res) {
	var text = null;
	
    messaging_events = req.body.entry[0].messaging;
	for (i = 0; i < messaging_events.length; i++) {	
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;

        if (event.message && event.message.text) {
			text = event.message.text;
		}else if (event.postback && !text) {
			text = event.postback.payload;
		}else{
			break;
		}
		
		var params = {
			input: text,
			context: {"conversation_id": conversation_id}
		}

		var payload = {
			workspace_id: workspace
		};

		if (params) {
			if (params.input) {
				params.input = params.input.replace("\n","");
				payload.input = { "text": params.input };
			}
			if (params.context) {
				payload.context = params.context;
			}
		}
		callWatson(payload, sender);
    }
    res.sendStatus(200); 
});

function callWatson(payload, sender) {
	w_conversation.message(payload, function (err, convResults) {
        var responseText = null;
        var responseText_Aux = [];
        var convInputs = null;
        var clientArray = [];
        
        // console.log(payload);
        
        if (err) {
            return responseToRequest.send("Erro.");
        }
		
		if(convResults.context != null)
    	   conversation_id = convResults.context.conversation_id;
        if(convResults != null && convResults.output != null){
            // console.log(convResults.intents[0].intent);
            convInputs = payload.input.text;
            // console.log(convInputs);
            // console.log(convResults.intents[0].confidence);
            if (convResults.intents[0].intent == 'pesquisarcliente')
            {
                //console.log('dentro do if de intent');
                if (convResults.intents[0].confidence >= 0.25)
                {
                    //console.log('dentro do if de confidence');
                    // console.log(MongoClient);
                    MongoClient.connect(url, function(err, db)
                    {
                        // console.log('cursor'+cursor);
                        // console.log('função do mongoDB');
                        var cursor = db.collection('clients').find({'code': convInputs});
                        //console.log('dentro do cursor');
                        //console.log('cursor'+cursor);
                        //console.log('convInputs'+convInputs);
                        cursor.forEach(function(doc, err)
                        {
                            //console.log('foreach do cursor');
                            if (err)
                                console.log('Erro ao consultar '+ err);
                            clientArray.push(doc);
                            //console.log('doc '+ doc);    
                        }, function()
                        {
                            db.close();
                            if (clientArray == '')
                            {
                                responseText_Aux[0] = 'Desculpe, eu não achei o que você procura. Talvez o cliente não exista ou o código esteja incorreto. Por gentileza, tente novamente';
                            }
                            else 
                            {
                                var clientResult = clientArray[0];
                                // console.log('clientResult '+clientResult.nome);
                                responseText_Aux[0] = "O cliente é " +clientResult.nome+".";
                                // responseText += "</br>Mas eu sei mais coisas deste cliente, veja só:</br>";
                                //count++;
                                // var textTreated ="";
                                // textTreated = clientResult.ticket_medio.replace(".",",");
                                responseText_Aux[1] = "O valor médio em compras deste cliente na TPT é " +clientResult.ticket_medio+".\r\n";

                                // textTreated = "";
                                // textTreated = clientResult.maior_compra.replace(".",",");
                                responseText_Aux[1] +="Sendo que este cliente teve como maior valor de compra " +clientResult.maior_compra+".\r\n";
                               // count++;
                                responseText_Aux[2] = "Os últimos destinos viajados pelo cliente são: " +clientResult.destinos+".";
                                //count++;
                                if (clientArray[0].suggestions == '')
                                {
                                    responseText_Aux[3] +='Porém não pensei em nada para recomendar para esse cliente :(. Mas conforme ele for viajando, vou recomendando.';
                                }
                                else
                                {
                                   var suggestions = clientArray[0].suggestions;
                                //    console.log('suggestions'+suggestions);
                                   responseText_Aux[3] = "Recomendo para o cliente os seguintes destinos: ";
                                   responseText_Aux[3] += suggestions.destination1;
                                   responseText_Aux[3]  += ", "+suggestions.destination2;
                                   responseText_Aux[3]  += ", "+suggestions.destination3;
                                   responseText_Aux[3]  += ", "+suggestions.destination4;
                                   responseText_Aux[3]  += ", "+suggestions.destination5;
                                   responseText_Aux[3]  += " e "+suggestions.destination6;
                                   count++;
                                }
                                if (clientArray == '')
                                {
                                    responseText_Aux[1] = "Espero ter ajudado, se precisar fazer outra pesquisa, basta colocar um novo código :)";
                                }
                                responseText_Aux[4] = "Espero ter ajudado, se precisar fazer outra pesquisa, basta colocar um novo código :)";
                            }
                            // convResults.output.text = responseText; 
                            //console.log('responseText_Aux' +responseText_Aux);
                            // sendMessage(sender, responseText);
                            var count = 0;
                            intervalReq(responseText_Aux, count, sender); 
                            //
                        });
                    });
                }
            }
            else 
            {
                var i = 0;
			    while(i < convResults.output.text.length)
                {
				    sendMessage(sender, convResults.output.text[i++]);
                }
     		}
		}      
    });
}


//A função abaixo trata de maneira assíncrona os resultados da função de busca, pegando  item a item e exibindo na tela em uma ordem pré específica.
//o delay de 2,5 segundos pode parecer muito, mas permite que o usuário não veja o robo como algo tão instantâneo 
//futuras implementações podem contemplar promisses ou async functions no lugar do mecanismo que estamos criando
function intervalReq(responseText_Aux, count, sender)
{

                            
    sendMessage(sender, responseText_Aux[count]);
    count++;
                            
    if (responseText_Aux.length > count)
    {
        setTimeout(function ()
        {
           intervalReq(responseText_Aux, count, sender);
        }, 2500);
    } 
}

function sendMessage(sender, text_) {
	text_ = text_.substring(0, 319);
	messageData = {	text: text_ };

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        json: {
            recipient: { id: sender },
            message: messageData,
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};

var token = "";
var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);
});
