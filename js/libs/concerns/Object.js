(function (__undefined) {
    // http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
    Object.byString = function(o, s) {
        if (s === __undefined) {
            return;
        }
        
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                o = o[k];
            } else {
                return;
            }
        }
        return o;
    };
    
    /**
     * jQuery map equiv
     * @param {type} callbackfn
     * @returns {Array.prototype@call;map@call;filter}
     *
    Object.prototype.$map = function (callbackfn) {
        return this.map(callbackfn).filter(function (value) {
            return value !== null;
        });
    };
    
    Object.prototype.map = function (callbackfn) {
        var self = this.valueOf();
        
        self.forEach(function (value, key) {
            self[key] = callbackfn(value, key, self);
        });
        
        return self;
    };
    
    if (!$) {
        Object.prototype.forEach = function (callbackfn) {
            for (var key in this) {
                if (!this.hasOwnProperty(key)) {
                    continue;
                }

                /*
                console.log('`value`:', this[key]);
                console.log('`key`:', key);
                console.log('`this`:', this);
                callbackfn(this[key], key, this);
            }
        };
    }//*/
})();