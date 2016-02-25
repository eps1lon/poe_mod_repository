(function (__undefined) {
    var Class = require('./Inheritance');
    require('./concerns/Array');
    
    if (window.jQuery === __undefined) {
        console.error("need jQuery object with window context");
        return;
    }
    var $ = window.jQuery;
    
    /**
     * class DataDependency
     * 
     * class for loading a json data
     */
    var DataDependency = Class.extend({
        /**
         * 
         * @param {String} path path to json data
         * @param {String} loading_indicator jquery selector for loading indicator class
         * @returns {DataDependency}
         */
        init: function (path, loading_indicator) {
            this.path = path;
            this.loading_indicator = loading_indicator;
            
            this.state_attr = DataDependency.STATE_ATTR;
        },
        /**
         * returns $.getJSON 
         * 
         * @param {Function} done callback on $.ajax.done
         * @returns {$.Dereferred}
         */
        getJSON: function (done) {
            var that = this;
            $(this.loading_indicator).attr(this.state_attr, DataDependency.STATE.LOADING);
            
            return $.getJSON(this.path, done)
                .done(function () {
                    $(that.loading_indicator).attr(that.state_attr, DataDependency.STATE.DONE);
                })
                .fail(function () {
                    $(that.loading_indicator).attr(that.state_attr, DataDependency.STATE.FAIL);
                });
        }
    });
    
    DataDependency.STATE = {
        LOADING: 1,
        DONE: 2,
        FAIL: 3
    };
    
    /**
     * default loading state attr
     */
    DataDependency.STATE_ATTR = "data-loading-state";
    
    module.exports = DataDependency;
}).call(this);