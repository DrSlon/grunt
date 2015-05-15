/**
 * grunt-mage
 */

'use strict';

module.exports = function(grunt, options) {
    var mage = require('./lib/mage')(grunt);

    function getN98Config() {
        var cnf = grunt.config('mage')['n98magerun'];
        cnf['flags'].push(grunt.template.process("root-dir=\"<%= docroot %>\"",{data: {docroot:mage.getDocumentRoot()}}));

        return cnf;
    }

    grunt.registerTask('mage:composer', 'Composer manager', function(cmd) {
        //TODO: use slice of array
        var flags = [];
        for (var i=1; i < arguments.length; i++) {
            flags.push(arguments[i]);
        }

        var $path = require('path');
        var cnf = grunt.config('mage')['composer'];
        var dir = $path.normalize(process.cwd() + '/'+ grunt.config('mage')['composer']['cwd']).replace(/[\\\/]*$/g,'');

        cnf['flags'].push(grunt.template.process("working-dir=\"<%= dir %>\"",{data: {dir: dir}}));

        mage.run(cnf, cmd, flags);
    });

    grunt.registerTask('mage:patches:apply', 'Magento Patch Tools', function() {
        var patches = grunt.config('mage')['_options_']['patches'] || [],
            dir     = 'data/patches/content';

        mage.applyPatches(patches);
        mage.updatePatches(dir);
    });

    grunt.registerTask('mage:git', 'Git Tools', function(cmd) {
        mage.exec('git ' + cmd, false);
    });

    grunt.registerTask('mage:n98:cache', 'Magento N98 Cli Tools [cache]', function(cmd) {
        var flags = [];
        for (var i=1; i < arguments.length; i++) {
            flags.push(arguments[i]);
        }

        var cnf = getN98Config();
        mage.run(cnf, ('cache:'+cmd), flags);
    });

    grunt.registerTask('mage:session:clean', 'Magento Redis Cli Tools', function() {
        if (mage.cleanSession()) {
            grunt.log.oklns('Session is cleaned');
        } else {
            grunt.log.errorlns('Session is not cleaned');
        }
    });

    grunt.registerTask('mage:redis:flush', 'Magento Redis Cli Tools', function() {
        mage.flushRedis();
    });

    grunt.registerTask('mage:db:create', 'Create DataBase', function() {
        if (grunt.file.exists(mage.getLocalXmlPath())) {
            grunt.fail.warn('Unable to create db. Magento is already installed');//abort
            //return grunt.log.errorlns('Magento is already installed. Terminating');
        } else {
            if (mage.createDb() == 0) {
                grunt.log.oklns('Database "' + mage.getEnvOption('db.dbname') + '" is created');
            }
        }
    });

    grunt.registerTask('mage:db:drop', 'Drop DataBase', function() {
        if (mage.dropDb() == 0) {
            grunt.log.oklns('Database "' + mage.getEnvOption('db.dbname') + '" is removed');
        }

        if (mage.deleteLocalXml()) {
            grunt.log.oklns('"local.xml" is removed');
        }
    });

    grunt.registerTask('mage:db:dump', 'Create DataBase', function() {
        var file = mage.dumpDb();
        if (file) {
            grunt.log.oklns('Database DUMP succesfully exported to: '+file);
        } else {
            grunt.log.errorlns('Database DUMP is unsuccesful');
        }
    });

    grunt.registerTask('mage:db:import', 'Import DataBase', function() {
        if (!mage.hasEnvOption('import.data')) {
            return grunt.log.writelns('Attribute "import.data" is empty. There are not any data [sql] for import');
        }

        var file = mage.getEnvOption('import.data');
        if (grunt.file.exists(file)) {
            if (mage.importDb(file) == 0) {
                grunt.log.oklns('Import of database "' + mage.getEnvOption('db.dbname') + '" is succesfull');
            }
        } else {
            grunt.log.errorlns('The import file "' + file + '" is not exists');
        }
    });

    grunt.registerTask('mage:config-xml:setup', 'Setup DataBase', function() {
        mage.deleteLocalXml();

        if (mage.setupDb() == 0) {
            grunt.log.oklns('Generated Magento config');
            mage.deleteLocalXml();
        }

        grunt.task.run('mage:config-xml:regenerate');
    });

    grunt.registerTask('mage:content:import', 'Import Files into Document Root', function() {
        var path = mage.getEnvOption('import.content');

        if (!path || !grunt.file.exists(path)) {
            return grunt.log.errorlns('Attribute "import.content" is not valid');
        }

        var files = grunt.file.expand(path + '/*');
        if (files.length > 0) {
            mage.importFiles(files)
            grunt.log.oklns('Import files was succesfull');
        }
    });

    grunt.registerTask('mage:config-xml:remove', 'Remove Magento Config [local.xml]', function() {
        var file = mage.getLocalXmlPath();
        if (!grunt.file.exists(file)) {
            return grunt.log.errorlns('"Local.xml" does not exist')
        } else if (grunt.file.delete(file)) {
            return grunt.log.oklns('Succesfully removed "local.xml" file');
        }
        grunt.fail.warn('"Local.xml" is not deleted');
    });

    grunt.registerTask('mage:config-xml:regenerate', 'Create Magento Config [local.xml]', function() {
        if (grunt.file.exists(mage.getLocalXmlPath())) {
            return grunt.fail.warn('Unable to regenerate "local.xml". Magento is already installed'); //abort
        }

        grunt.file.write(mage.getLocalXmlPath(), mage.getLocalXmlData());
        grunt.log.oklns('Created new "local.xml" file');
    });

    grunt.registerTask('mage:system', 'Post Setup Magento System Configuration', function(cmd) {
        //cmd is "init-setup" or "post-setup"
        var system = mage.getEnvOption('magento.'+cmd + '-system') || {};

        var sys = {};
        for(var k1 in system) {
            for (var k2 in system[k1]) {
                for (var k3 in system[k1][k2]) {
                    var path = k1 + '/' + k2 + '/' + k3;
                    sys[path] = system[k1][k2][k3];
                }
            }
        }

        var n98Cnf = getN98Config();
        for (var path in sys) {
            var cmd = 'config:set ' + path + ' ' + sys[path];
            mage.run(n98Cnf, cmd, []);
        };
    });

    grunt.registerTask('mage:clone:pull', 'Pull Magento code for test', function() {
        var partDocRoot = mage.getRelativeDocumentRoot();
        var resp = mage.exec("git ls-files | grep '^"+partDocRoot+"'");
        var data = resp.output.split("\n");
        var dir = grunt.config('mage')['_options_']['temp-folder'] || "./temp";
        dir = dir + '/git-files';

        var RegExpQuote = function(str) {
            return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
        };

        var reg = new RegExp("^"+RegExpQuote(partDocRoot)+"/", 'g');
        data.forEach(function(srcpath){
            if (srcpath) {
                var destpath = srcpath.replace(reg,"");
                grunt.file.copy(srcpath, dir + "/" + destpath);
            }
        });
        grunt.log.oklns('Files copied [' + data.length + '] in "' + dir + '" folder');
    });
};
