'use strict';

/**
 * Module dependencies.
 */
var $shell = require('shelljs');
var $prettyjson = require('prettyjson');
var $path = require('path');

function printjs(data, cnf) {
    console.log($prettyjson.render(data, cnf));
}

module.exports = function($grunt) {

    function getUnique(arr) {
        var o = {}, a = [], i, e;
        for (i = 0; e = arr[i]; i++) {o[e] = 1};
        for (e in o) {a.push (e)};
        return a;
    };

    function exec(cmd, silent) {
        $grunt.log.writeln('>> Running:$ '.yellow + cmd.green);

        if (typeof silent == "undefined") {
            silent = true;
        }

        var response = $shell.exec(cmd, {silent : silent});

        if (response.code !== 0) {// CODE > 0 is ERROR
            $grunt.log.errorlns('Error [' + response.code + ']: ' + response.output);
            //$grunt.log.writeln();
        }

        return response;
    };

    var _mage = {
        grunt          : null,
        root_dir       : null,
        vendor_dir     : null,
        vendor_bin_dir : null,
        composer_json_path : null,
        composer_lock_path : null,
        load_composer      : false,

        _settings_ : {
            template_local_xml : 'data/configs/local.xml',
            template_session_save_path_xml : 'data/configs/local/session_save_path.xml',
            template_cache_xml : 'data/configs/local/cache.xml',
            template_full_page_cache_xml : 'data/configs/local/full_page_cache.xml',
            local_xml  : '<%= root_dir %>/app/etc/local.xml',
            backup_path : 'backups/<%= env %>-<%= date %>-<%= time %>.sql.tgz',
            cmd : {
                db : {
                    mysql   : 'mysql -h<%= host %> -u<%= username %> -p<%= password %> <%= dbname %>',
                    drop    : 'mysql -h<%= host %> -u<%= username %> -p<%= password %> -e "DROP DATABASE IF EXISTS <%= dbname %>"',
                    create  : 'mysql -h<%= host %> -u<%= username %> -p<%= password %> -e "CREATE DATABASE IF NOT EXISTS <%= dbname %> CHARACTER SET utf8 COLLATE utf8_unicode_ci"',
                    import  : '<%= mysql %> < <%= process.cwd() %>/<%= file %>',
                    backup  : 'mysqldump -u <%= user %> -p<%= pass %> -h<%= host %> <%= name %> | gzip -c > <%= path %>',

                    archdata : '<%= arch.name %> <%= arch.opts %> <%= arch.file %> | <%= mysql %>',

                    restore : 'gunzip < backups/<%= file %> | mysql -h<%= host %> -u<%= user %> -p<%= pass %> <%= name %>',

                    setup : [
                        'php -f <%= rootdir %>/install.php --',
                        '--license_agreement_accepted "yes"',
                        '--locale "<%= settings.locale %>"',
                        '--timezone "<%= settings.timezone %>"',
                        '--default_currency "<%= settings.currency %>"',
                        '--session_save "<%= session.save %>"',
                        '--db_host "<%= db.host %>"',
                        '--db_name "<%= db.dbname %>"',
                        '--db_user "<%= db.username %>"',
                        '--db_pass "<%= db.password %>"',
                        '--db_prefix "<%= db.table_prefix %>"',
                        '--url "<%= url.unsecure %>"',
                        '--secure_base_url "<%= url.secure %>"',
                        '--use_rewrites "yes"',
                        '--use_secure "no"',
                        '--use_secure_admin "no"',
                        '--skip_url_validation',
                        '--enable_charts "yes"',
                        '--admin_frontname "<%= admin.route %>"',
                        '--admin_firstname "<%= admin.firstname %>"',
                        '--admin_lastname "<%= admin.lastname %>"',
                        '--admin_email "<%= admin.email %>"',
                        '--admin_username "<%= admin.username %>"',
                        '--admin_password "<%= admin.password %>"',
                        '--encryption_key "<%= encryption_key %>"'
                    ]
                }
            }
        },

        init : function(grunt) {
            this.grunt = grunt;
            return this;
        },

        getGrunt : function() {
            return this.grunt;
        },

        getEnvOptions : function() {
            var name = this.getGrunt().option('env') || 'default';

            return this.getGrunt().config('mage')['env'][name];
        },

        getEnvOption : function (key, def) {
            var data = this.getEnvOptions(),
                err  = false;

            key.split('.').forEach(function (param) {
                if (!err && data[param]) {
                    data = data[param];
                } else {
                    err = true;
                }
            });

            if (!err) {
                return data;
            }

            return def;
        },

        hasEnvOption : function (key) {
            return typeof this.getEnvOption(key) != 'undefined';
        },

        getDocumentRoot : function() {
            this._loadComposerData();

            var path = [this.root_dir];

            for (var i=0; i < arguments.length; i++) {
                path.push(arguments[i]);
            }

            return $path.normalize(path.join('/'));
        },

        getRelativeDocumentRoot : function() {
            return this.getDocumentRoot().replace(process.cwd(),'').replace(/\\/g,'/').replace(/^\/|\/$/g,'');
        },

        getVendorDir : function() {
            this._loadComposerData();

            return this.vendor_dir;
        },

        getVendorBinDir : function() {
            this._loadComposerData();

            return this.vendor_bin_dir;
        },

        getComposerJsonPath : function() {
            this._loadComposerData();

            return this.composer_json_path;
        },

        getComposerLockPath : function() {
            this._loadComposerData();

            return this.composer_lock_path;
        },

        _loadComposerData : function() {
            if (!this.load_composer) {
                var jsonFile = 'composer.json',
                    lockFile = 'composer.lock',
                    rootDir  = process.cwd();

                if (this.getGrunt().config('mage')['composer']['cwd']) {
                    rootDir += '/' + this.getGrunt().config('mage')['composer']['cwd'];
                    jsonFile = $path.normalize(rootDir + '/' + jsonFile);
                    lockFile = $path.normalize(rootDir + '/' + lockFile);
                }

                if (!this.grunt.file.exists(jsonFile)) {
                    this.grunt.fail.fatal('"composer.json" is not found');
                }

                this.composer_json_path = jsonFile;
                this.composer_lock_path = lockFile;

                var vendorDir    = rootDir,
                    vendorBinDir = rootDir;

                var composer = this.grunt.file.readJSON(jsonFile);
                if (typeof composer['extra'] == 'object' && composer['extra']['magento-root-dir']) {
                    rootDir += '/' + composer['extra']['magento-root-dir'].replace(/^[\\\/]+$/ig, ''); // "/^[\.\\\/]+|[\\\/]+$/ig"
                }

                if (typeof composer['config'] == 'object' && composer['config']['vendor-dir']) {
                    vendorDir += '/' + composer['config']['vendor-dir'].replace(/^[\\\/]+$/ig, ''); // "/^[\.\\\/]+|[\\\/]+$/ig"
                } else {
                    vendorDir += '/vendor';
                }

                if (typeof composer['config'] == 'object' && composer['config']['bin-dir']) {
                    vendorBinDir += '/' + composer['config']['bin-dir'].replace(/^[\\\/]+$/ig, ''); // "/^[\.\\\/]+|[\\\/]+$/ig"
                } else {
                    vendorBinDir += '/vendor/bin';
                }

                this.root_dir       = $path.normalize(rootDir);
                this.vendor_dir     = $path.normalize(vendorDir);
                this.vendor_bin_dir = $path.normalize(vendorBinDir);

                this.load_composer = true;
            }

            return this;
        },

        getLocalXmlPath : function() {
            return this.getGrunt().template.process(this._settings_.local_xml,{"data":{"root_dir":this.getDocumentRoot()}});
        },

        deleteLocalXml : function() {
            var file = this.getLocalXmlPath();
            if ($grunt.file.exists(file)) {
                return $grunt.file.delete(file);
            }
            return false;
        },

        renderLocalXml : function(options) {
            if (typeof options['data'] == 'undefined') {
                options = {"data" : options};
            }
            var file     = __dirname +'/../'+this._settings_.template_local_xml,
                template = this.getGrunt().file.read(file);

            return this.getGrunt().template.process(template,options);
        },

        getLocalXmlData : function() {
            var options = this.getEnvOption('magento');
            options     = require('util')._extend(options, {"db" : this.getEnvOption('db')});

            var tmpl = {};
            if (this.hasEnvOption("magento.session.save_path")) {
                var renderSessionSavePath = function(my, options) {
                    var file     = __dirname +'/../'+my._settings_.template_session_save_path_xml;
                    var template = my.getGrunt().file.read(file);

                    return my.getGrunt().template.process(template,{data: options});
                }
                tmpl['session_save_path'] = renderSessionSavePath(this,options);
            }

            if (this.hasEnvOption("magento.cache")) {
                var renderCache = function(my, options) {
                    var file     = __dirname +'/../'+my._settings_.template_cache_xml;
                    var template = my.getGrunt().file.read(file);

                    return my.getGrunt().template.process(template,{data: options});
                }
                tmpl['cache'] = renderCache(this,options);
            }

            if (this.hasEnvOption("magento.full_page_cache")) {
                var renderFullPageCache = function(my, options) {
                    var file     = __dirname +'/../'+my._settings_.template_full_page_cache_xml;
                    var template = my.getGrunt().file.read(file);

                    return my.getGrunt().template.process(template,{data: options});
                }
                tmpl['full_page_cache'] = renderFullPageCache(this,options);
            }

            options['_tmpl'] = tmpl;

            return this.renderLocalXml(options);
        },

        createDb : function() {
            var cmd = this.grunt.template.process(this._settings_.cmd.db.create,{data:this.getEnvOption('db')});
            if (!this.getEnvOption('db.password')) {
                cmd = cmd.replace(' -p', '');
            }
            return exec(cmd).code;
        },

        dropDb : function() {
            var cmd = this.grunt.template.process(this._settings_.cmd.db.drop,{data:this.getEnvOption('db')});
            if (!this.getEnvOption('db.password')) {
                cmd = cmd.replace(' -p', '');
            }
            return exec(cmd).code;
        },

        setupDb : function() {
            var data = this.getEnvOption('magento');
            data     = require('util')._extend(data, {rootdir : this.getDocumentRoot(), db : this.getEnvOption('db')});

            if (this.getEnvOption('magento.session.save') != 'files' || this.getEnvOption('magento.session.save') != 'db') {
                data['session']['save'] = 'files';
            }

            var cmd  = this.grunt.template.process(this._settings_.cmd.db.setup.join(' '), {data : data});

            return exec(cmd).code;
        },

        importDb : function() {
            var cmd  = '',
                data = this.getEnvOption('db'),
                file = this.getEnvOption('import.data');

            //mysql command
            var mysql = $grunt.template.process(this._settings_.cmd.db.mysql,{data:data});
            if (!this.getEnvOption('db.password')) {
                mysql = mysql.replace(/\s\-p/g, '');
            }

            var ext = file.match(/([^\.]*)$/)[1];
            if (ext == 'sql') {
                cmd  = this.grunt.template.process(this._settings_.cmd.db.import,{data : {mysql:mysql, file:file}});
            } else {
                if (ext == 'zip') {// 'unzip -p file.zip'
                    var arch = {
                        name: 'unzip',
                        opts: '-p',
                        file: file
                    };
                } else if (ext == 'gz' || ext == 'tar' || ext == 'tgz' || ext == 'bz2') {// 'tar -xOzf file.tar'
                    var arch = {
                        name: 'tar',
                        opts: '-xOzf',
                        file: file
                    };
                }
                cmd  = $grunt.template.process(this._settings_.cmd.db.archdata,{data: {'arch': arch, 'mysql' : mysql}});
            }

            return exec(cmd).code;
        },

        importFiles : function(files) {
            return $shell.cp('-Rf', files, this.getDocumentRoot()); // -Rf
        },

        run : function(config, target, flags) {
            var builder = require('./command')(this.grunt);
            var command = builder.withConfig(config).withFlags(flags).withCommand(target).build();

            return exec(command, false);
        },

        flushRedis : function() {
            var _cmd  = "redis-cli -h <%= host %> -p <%= port %> -a <%= password %> flushall",
                cache = ['cache','full_page_cache'],
                cmds  = [], data = [];

            var xml2js = require('xml2js');
            var fs     = require('fs');

            try {
                var filePath = $path.normalize(this.getDocumentRoot()+'/app/etc/local.xml');
                var fileData = fs.readFileSync(filePath, 'utf8');// it's xml data

                (new xml2js.Parser()).parseString(fileData.substring(0, fileData.length), function (err, result) {
                    data = result;// it's json data
                });

                for (var i=0; i<cache.length; i++) {
                    var cacheNode = data['config']['global'][0][cache[i]][0];
                    if (cacheNode['backend'][0].match(/redis/ig)) {
                        var host = cacheNode['backend_options'][0]['server'][0],
                            port = cacheNode['backend_options'][0]['port'][0],
                            pass = cacheNode['backend_options'][0]['password'][0];
                        var cmd = $grunt.template.process(_cmd, {data: {'host': host, 'port': port, 'password': pass}});
                        if (pass == '') {
                            cmd = cmd.replace(/\s\-a\s/gi, '');
                        }
                        cmds.push( cmd );
                    }
                }
            } catch(e) {
                $grunt.log.errorlns(e);
                //$grunt.log.oklns('Redis is not founded.');
            }

            for (var i= 0, cmds = getUnique(cmds); i<cmds.length; i++) {
                var ret = exec(cmds[i], false);
                if (ret.code !== 0) {// error > 0
                    return ret.code;
                }
            }

            return 0;
        },

        applyPatches : function (patches) {
            //copy patches to site/mage dir
            $shell.cp('-Rf', patches, this.getDocumentRoot()); // -Rf

            var $this = this;
            patches.forEach(function(patch){
                //run patch
                patch = $path.basename(patch);
                var cmds = [
                    'cd ' + $this.getDocumentRoot(),
                    'sh ' + patch
                ];
                $this.exec(cmds.join(' && '), false);

                //delete patch file from site/mage dir
                $grunt.file.delete($this.getDocumentRoot(patch));
            });

            // check & put new files to ignore list
            var partDocRoot = this.getRelativeDocumentRoot();
            var cmd = "git status -s -u | grep ^" + partDocRoot;
            var ret = exec(cmd, false);

            var RegExpQuote = function(str) {
                return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
            };

            if (ret.code == 0) {
                var files = [];
                ret.output.split("\n").forEach(function(line) {
                    if (line) {
                        var file = line.split(" ")[1];
                        var reg = new RegExp("^"+RegExpQuote(partDocRoot), 'g');
                        file = file.replace(reg, "");
                        files.push(file);
                    }
                });

                this.addDataToGitIgnoreList(files);
            }

            return this;
        },

        updatePatches : function (dir) {
            // copy $dir to DocRoot
            var files = $grunt.file.expand(dir + '/*');
            $shell.cp('-Rf', files, this.getDocumentRoot()); // -Rf

            // add $files to .ignore list
            // get $ignFiles data
            var fs       = require('fs'),
                path     = require('path'),
                ignFiles = [];

            var dirTree = function (filename, files) {
                var stats = fs.lstatSync(filename),
                    files = files || [];

                if (stats.isDirectory()) {
                    fs.readdirSync(filename).map(function(child) {
                        return dirTree(filename + '/' + child, files);
                    });
                } else {
                    files.push(filename);
                }
                return files;
            }

            dirTree(dir, ignFiles);

            var $this = this;
            ignFiles.forEach(function(file, i) {
                ignFiles[i] = file.replace(dir, '').replace(/\\/g,'/');
            });

            // add $ignFiles to ignore file
            this.addDataToGitIgnoreList(ignFiles);
        },

        addDataToGitIgnoreList : function(files) {
            var fs         = require('fs');
            var ignoreFile = this.getDocumentRoot('.gitignore');
            var ignoreData = fs.readFileSync(ignoreFile, 'utf8').split(/[\n]/);
            files.forEach(function(file, i) {
                if (!(ignoreData.indexOf(file) >= 0)) {//not found
                    ignoreData.push(file);
                }
            });
            $grunt.file.write(ignoreFile, ignoreData.join("\n"));
        },

        cleanSession : function() {
            var path = this.getDocumentRoot('var/session/*');
            $grunt.file.expand(path).forEach(function(file){
                $grunt.file.delete(file);
            });

            return true;
        },

        exec : function (cmd, silent) {
            return exec(cmd, silent);
        },

        _extend : function(_env) {
            //env = env || 'develop';
            //var _env = grunt.config('mage')['env'][env];
            if (_env['_extend']) {
                var extend = require('util')._extend;
                for (var i = _env['_extend'].length; i>0; i--) {
                    var parent = this._extend(_env['_extend'][i-1]);
                    _env = extend(parent, _env);
                }
            }
            delete _env['_extend'];

            return _env;
        }
    }

    _mage.init($grunt);

    return _mage;
};