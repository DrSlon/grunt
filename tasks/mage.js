/**
 * grunt-mage
 */
/**
 * 1. !?! авт. добавить файлы после импорта в игнор лист
 * 2. git ls-files | grep "^public"
 */
'use strict';

module.exports = function(grunt, options) {
    var mage = require('./lib/mage')(grunt);

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
            dir     = 'data/patches/update';

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

        var cnf = grunt.config('mage')['n98magerun'];
        cnf['flags'].push(grunt.template.process("root-dir=\"<%= docroot %>\"",{data: {docroot:mage.getDocumentRoot()}}));

        mage.run(cnf, ('cache:'+cmd), flags);
    });

    grunt.registerTask('mage:session-folder:clean', 'Magento Redis Cli Tools', function() {
        if (mage.cleanSession()) {
            grunt.log.oklns('Session is cleaned');
        } else {
            grunt.log.errorlns('Session is not cleaned');
        }
    });

    grunt.registerTask('mage:redis:flush', 'Magento Redis Cli Tools', function() {
        mage.flushRedis();
    });

    grunt.registerTask('mage:drop', 'Drop Magento folder', function() {
        var dir = mage.getDocumentRoot();
        if (process.cwd().replace(/[\\\/]+$/ig, '') == dir.replace(/[\\\/]+$/ig, '')) {
            grunt.fail.warn('I cann\'t delete "root" directory of project');
        }
        if (grunt.file.exists(dir)) {
            if (grunt.file.delete(dir)) {
                grunt.file.mkdir(dir);
                grunt.log.oklns('Cleaned Magento directory "' + dir + '"');
            } else {
                grunt.log.errorlns('Cann\'t remove Magento directory ["' + dir + '"]');
            }
        } else {
			grunt.file.mkdir(dir);
		}

        var dir = mage.getVendorDir();
        if (process.cwd().replace(/[\\\/]+$/ig, '') == dir.replace(/[\\\/]+$/ig, '')) {
            grunt.fail.warn('I cann\'t delete "vendor" directory of project');
        }
        if (grunt.file.exists(dir)) {
            if (grunt.file.delete(dir)) {
                grunt.log.oklns('Dropped vendor directory ["' + dir + '"]');
            } else {
                grunt.log.errorlns('Cann\'t remove vendor directory ["' + dir + '"]');
            }
        }

        var dir = mage.getVendorBinDir();
        if (process.cwd().replace(/[\\\/]+$/ig, '') == dir.replace(/[\\\/]+$/ig, '')) {
            grunt.fail.warn('I cann\'t delete "vendor-bin" directory of project');
        }
        if (grunt.file.exists(dir)) {
            if (grunt.file.delete(dir)) {
                grunt.log.oklns('Dropped vendor-bin directory ["' + dir + '"');
            } else {
                grunt.log.errorlns('Cann\'t remove vendor-bin directory ["' + dir + '"]');
            }
        }

        var dir = mage.getComposerLockPath();
        if (process.cwd().replace(/[\\\/]+$/ig, '') == dir.replace(/[\\\/]+$/ig, '')) {
            grunt.fail.warn('I cann\'t delete "composer.lock" file');
        }
        if (grunt.file.exists(dir)) {
            if (grunt.file.delete(dir)) {
                grunt.log.oklns('Dropped "composer.lock" file ["' + dir + '"]');
            } else {
                grunt.log.errorlns('Cann\'t remove "composer.lock" file ["' + dir + '"]');
            }
        }

        grunt.task.run('mage:db:drop');
    });

    grunt.registerTask('mage:db:drop', 'Drop DataBase', function() {
        if (mage.dropDb() == 0) {
            grunt.log.oklns('Database "' + mage.getEnvOption('db.dbname') + '" is removed.');
        }

        if (mage.deleteLocalXml()) {
            grunt.log.oklns('"local.xml" is removed.');
        }
    });

    grunt.registerTask('mage:db:create', 'Create DataBase', function() {
        if (grunt.file.exists(mage.getLocalXmlPath())) {
            grunt.fail.warn('Unable to create db. Magento is already installed.');//abort
            //return grunt.log.error('Magento is already installed. Terminating.');
        } else {
            if (mage.createDb() == 0) {
                grunt.log.oklns('Database "' + mage.getEnvOption('db.dbname') + '" is created.');
            }
        }
    });

    grunt.registerTask('mage:config:setup', 'Setup DataBase', function() {
        mage.deleteLocalXml();

        if (mage.setupDb() == 0) {
            grunt.log.oklns('Generated Magento config.');
            mage.deleteLocalXml();
        }

        grunt.task.run('mage:config:regenerate');
    });

    grunt.registerTask('mage:db:import', 'Import DataBase', function() {
        if (!mage.hasEnvOption('import.data')) {
            return grunt.log.writelns('Attribute "import.data" is empty. There are not data for import.');
        }

        if (mage.importDb() == 0) {
            grunt.log.oklns('Import of database "' + mage.getEnvOption('db.dbname') + '" is succesfull.');
        }
    });

    grunt.registerTask('mage:files:import', 'Import Files into Document Root', function() {
        var files = mage.getEnvOption('import.files') || [];

        if (files.length == 0) {
            return grunt.log.writelns('Attribute "import.files" is empty. There are not files for import.');
        }

        if (mage.importFiles(files)) {
            grunt.log.oklns('Import of files was succesfull.');
        }
    });

    grunt.registerTask('mage:config:remove', 'Remove Magento Config [local.xml]', function() {
        var file = mage.getLocalXmlPath();
        if (!grunt.file.exists(file)) {
            return grunt.log.error('"Local.xml" does not exist.')
        } else if (grunt.file.delete(file)) {
            return grunt.log.oklns('Succesfully removed "local.xml" file.');
        }
        grunt.log.error('"Local.xml" is not deleted.');
    });

    grunt.registerTask('mage:config:regenerate', 'Create Magento Config [local.xml]', function() {
        if (grunt.file.exists(mage.getLocalXmlPath())) {
            return grunt.fail.warn('Unable to regenerate "local.xml". Magento is already installed.'); //abort
        }

        grunt.file.write(mage.getLocalXmlPath(), mage.getLocalXmlData());
        grunt.log.oklns('Created new "local.xml" file.');
    });
};
