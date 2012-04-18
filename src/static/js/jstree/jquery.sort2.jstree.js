/*
 * Modified jsTree sort plugin that can be disabled and enabled at any time for better performance
 * Sorts items alphabetically (or using any other function)
 */
(function ($) {
  
  $.jstree.plugin("sort2", {
    __init : function () {
      this.get_container()
        .bind("load_node.jstree", $.proxy(function (e, data) {
            var obj = this._get_node(data.rslt.obj);
            obj = obj === -1 ? this.get_container().children("ul") : obj.children("ul");
            this.sort(obj);
          }, this))
        .bind("rename_node.jstree create_node.jstree create.jstree", $.proxy(function (e, data) {
            this.sort(data.rslt.obj.parent());
          }, this))
        .bind("move_node.jstree", $.proxy(function (e, data) {
            var m = data.rslt.np == -1 ? this.get_container() : data.rslt.np;
            this.sort(m.children("ul"));
          }, this));
      this._sortEnabled = true;
      this._sortQueue  = [];
      this.disableSort = function() {
        this._sortEnabled = false;
      };
      this.enableSort = function() {
        this._sortEnabled = true;
        this._sortQueued();
      };
      
      this._sortQueued = function() {
        var _this = this;
        this._sortQueue.forEach(function(obj) {
          if (obj.get(0)._jstree_sort_pending)
            _this.sort(obj);
          obj.get(0)._jstree_sort_pending = false;
        });
        this._sortQueue = [];
      };
      this._queueSort = function(obj) {
        obj.get(0)._jstree_sort_pending = true;
        this._sortQueue.push(obj);
      };
    },
    defaults : function (a, b) { return this.get_text(a) > this.get_text(b) ? 1 : -1; },
    _fn : {
      sort : function (obj) {
        if(this._sortEnabled) {
          var s = this._get_settings().sort2,
            t = this;
          obj.append($.makeArray(obj.children("li")).sort($.proxy(s, t)));
          obj.find("> li > ul").each(function() { t.sort($(this)); });
          this.clean_node(obj);
        } else {
          this._queueSort(obj);
        }
      }
    }
  });
})(jQuery);
//*/