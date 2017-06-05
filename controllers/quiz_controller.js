var models = require("../models");
var Sequelize = require('sequelize');

var paginate = require('../helpers/paginate').paginate;

// Autoload el quiz asociado a :quizId
exports.load = function (req, res, next, quizId) {

    models.Quiz.findById(quizId)
    .then(function (quiz) {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('No existe ningún quiz con id=' + quizId);
        }
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes
exports.index = function (req, res, next) {

    var countOptions = {};

    // Busquedas:
    var search = req.query.search || '';
    if (search) {
        var search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where = {question: { $like: search_like }};
    }

    models.Quiz.count(countOptions)
    .then(function (count) {

        // Paginacion:

        var items_per_page = 10;

        // La pagina a mostrar viene en la query
        var pageno = parseInt(req.query.pageno) || 1;

        // Crear un string con el HTML que pinta la botonera de paginacion.
        // Lo añado como una variable local de res para que lo pinte el layout de la aplicacion.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        var findOptions = countOptions;

        findOptions.offset = items_per_page * (pageno - 1);
        findOptions.limit = items_per_page;

        return models.Quiz.findAll(findOptions);
    })
    .then(function (quizzes) {
        res.render('quizzes/index.ejs', {
            quizzes: quizzes,
            search: search
        });
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes/:quizId
exports.show = function (req, res, next) {

    res.render('quizzes/show', {quiz: req.quiz});
};


// GET /quizzes/new
exports.new = function (req, res, next) {

    var quiz = {question: "", answer: ""};

    res.render('quizzes/new', {quiz: quiz});
};


// POST /quizzes/create
exports.create = function (req, res, next) {

    var quiz = models.Quiz.build({
        question: req.body.question,
        answer: req.body.answer
    });

    // guarda en DB los campos pregunta y respuesta de quiz
    quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz creado con éxito.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/new', {quiz: quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al crear un Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = function (req, res, next) {

    res.render('quizzes/edit', {quiz: req.quiz});
};


// PUT /quizzes/:quizId
exports.update = function (req, res, next) {

    req.quiz.question = req.body.question;
    req.quiz.answer = req.body.answer;

    req.quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz editado con éxito.');
        res.redirect('/quizzes/' + req.quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/edit', {quiz: req.quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = function (req, res, next) {

    req.quiz.destroy()
    .then(function () {
        req.flash('success', 'Quiz borrado con éxito.');
        res.redirect('/quizzes');
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = function (req, res, next) {

    var answer = req.query.answer || '';

    res.render('quizzes/play', {
        quiz: req.quiz,
        answer: answer
    });
};


// GET /quizzes/:quizId/check
exports.check = function (req, res, next) {

    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz: req.quiz,
        result: result,
        answer: answer
    });
};


var score=0; //puntuación inicial: cero puntos

// GET /quizzes/randomplay
exports.randomplay = function (req,res,next){

	//Si no se ha iniciado la sesión, la puntuación inicial es cero
	if (!req.session.score) req.session.score = 0;
	//Inicializamos el juego, cnt es menos1 porque si no daba error
	if(req.session.score === 0) req.session.cnt = [-1];

	//La respuesta será lo del cajetin o vacío
	var answer= req.query.answer || '';

	models.Quiz.count({where:{
		id:{$notIn: req.session.cnt}
		}})
	.then(function(cuenta){
	aleatorio= Math.floor(Math.random() * (cuenta - 0) +0);
	return models.Quiz.findAll({where:
	{ id: {$notIn: req.session.cnt}
	}})
		.then(function(quiz){
		//MI pregunta va a ser una aleatoria que no haya aparecido antes
		pregunta = quiz[aleatorio];
		req.session.cnt.push(pregunta.id);
		//renderizamos la pagina
		res.render('quizzes/random_play',{
			quiz: pregunta,
			answer: answer,
			score: req.session.score
	});});});
};


//GET quizzes/randomcheck/:quizId
exports.randomcheck = function(req, res, next) {
	var answer = req.query.answer || "";
	var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

	//si  la respuesta es la correcta entonces suma puntos y si no no se los sumes y en el array de contestados di que ya están contestados cnt[-1]
	if(result){
		req.session.score = req.session.score + 1;

        models.Quiz.count().then(function(cuenta){
        //si ya se han contestado todas las preguntas, se acaba el juego
        if(req.session.score === cuenta){
            req.session.cnt = [-1]; 
            var cuenta2= req.session.score; 
            req.session.score = 0;    
            res.render('quizzes/random_nomore', {
                score : cuenta2});
        
        //si no, me lleva a la pagina de resultados
        }
        else{
            res.render('quizzes/random_results',{
                quiz: req.quiz,
                result: result,
                score: req.session.score,
                answer: answer});
            }
        })}
	
    else{
        var cuenta1= req.session.score;
        req.session.score = 0;
        req.session.cnt = [-1];
        res.render('quizzes/random_results',{
                quiz: req.quiz,
                result: result,
                score: cuenta1,
                answer: answer});
        

            }
		};
	   
    


