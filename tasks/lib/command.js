'use strict';

module.exports = function($grunt) {
    var builder = {
        cmd    : null,
        flags  : [],
        config : null,

        withCommand : function(command) {
            this.cmd = command;
            return this;
        },

        withFlags : function(flags) {
            this.flags = flags;
            return this;
        },

        withConfig : function(options) {
            this.config = options;
            return this;
        },

        build : function() {
            var resource = this.config.cmd,
                template = "<%= cmd.resource %> <%= cmd.name %><%= cmd.flags %>";

            if (this.config.php.active) {
                resource = this.config.php.location;
                template = "php<%= php_opts %> <%= cmd.resource %> <%= cmd.name %><%= cmd.flags %>";
            }

            var params = {
                data: {
                    php_opts : this._getPhpOptions(),
                    cmd      : {
                        resource : resource,
                        name     : this.cmd,
                        flags    : this._getFlags()
                    }
                }
            };

            return  $grunt.template.process(template, params);
        },

        reset : function() {
            this.cmd    = null;
            this.flags  = [];
            this.config = null;

            return this;
        },

        _getFlags : function() {
            var flags = '', data = [];
            if (this.flags && this.flags.length > 0) {
                data = this.flags;
            } else if (this.config.flags) {
                data = this.config.flags;
            }

            for (var flag in data) {
                flags += ' --' + data[flag];
            }

            return flags;
        },

        _getPhpOptions : function() {
            var phpOptions = this.config.php.args,
                compressedOptions = '';
            if (phpOptions) {
                for (var option in phpOptions) {
                    compressedOptions += " -d " + option + "=" + phpOptions[option];
                }
            }

            return compressedOptions;
        }
    };

    return builder;
}