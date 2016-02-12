(function (__undefined) {
    /**
     * 
     * @returns {Boolean} true if every value in this array equal zero
     */
    Array.prototype.isZero = function () {
        var a = this.valueOf();
        for (var i = 0, length = a.length; i < length; ++i) {
            if (typeof a[i].isZero === 'function') {
                if (!a[i].isZero()) {
                    return false;
                }
            } else if (+a[i] !== 0) {
                return false;
            }
        }
        return true;
    };
    
    /*
    /**
     * @link {http://stackoverflow.com/questions/13486479/how-to-get-an-array-of-unique-values-from-an-array-containing-duplicates-in-java}
     * 
     * @returns {Array.prototype@call;reverse@call;filter@call;reverse}
     *
    Array.prototype.unique = function () {
        return this.reverse().filter(function (e, i, arr) {
            return arr.indexOf(e, i+1) === -1;
        }).reverse();
    };
    
    /**
     * jQuery map equiv
     * @param {type} callbackfn
     * @returns {Array.prototype@call;map@call;filter}
     *
    Array.prototype.$map = function (callbackfn) {
        return this.map(callbackfn).filter(function (value) {
            return value !== null;
        });
    };
    
    /**
     * intersection of two array
     * http://jsfiddle.net/neoswf/aXzWw/
     * 
     * @param {type} a
     * @param {type} b
     * @returns {Array|Array.intersect_safe.result}
     *
    Array.intersect = function (a, b)
    {
      var ai = bi= 0;
      var result = [];

      while( ai < a.length && bi < b.length ){
         if      (a[ai] < b[bi] ){ ai++; }
         else if (a[ai] > b[bi] ){ bi++; }
         else  they're equal *
         {
           result.push(ai);
           ai++;
           bi++;
         }
      }

      return result;
    };
    
    Array.prototype.intersect = function (other_arr) {
        return Array.intersect(this.valueOf(), other_arr);
    };//*/
})();