module.exports = function(grunt) {

    require('time-grunt')(grunt);

    //console.log(grunt.file.readJSON('grunt/mage.js'));

    require('load-grunt-config')(grunt, {
        jitGrunt: true
    });

    //console.log(grunt.getConfig());
    //grunt.config.init({slon:456})
    //grunt.initConfig({
    //    log: {
    //        foo: [1, 2, 3],
    //        bar: 'hello world',
    //        baz: false
    //    }
    //});

    grunt.registerMultiTask('log', 'Log stuff.', function() {
        grunt.log.writeln(this.target + ': ' + this.data);
    });
};