(function() {

/***************
 * Common data *
 ***************/

var filters = { custom: [ ], classes: [ ], stars: [ ] };

/***************
 * Controllers *
 ***************/

var app = angular.module('optc');

app.controller('MainCtrl',function($scope, $rootScope, $state, $stateParams, $timeout) {

    var colors = Chart.defaults.global.colours;
    colors = colors.splice(2,0,colors.splice(1,1)[0]);

    if (!$rootScope.hasOwnProperty('nightMode')) {
        $rootScope.nightMode = JSON.parse(localStorage.getItem('chars.night')) || false;
        $rootScope.$watch('nightMode',function(night) { localStorage.setItem('chars.night', JSON.stringify(night)); });
    }

    $scope.query = $state.params.query;

    $scope.$watch('query',function(query) {
        if (query === null || query === undefined || $scope.query == $stateParams.query) return;
        $state.go('.',{ query: $scope.query });
        $scope.table.parameters = CharUtils.generateSearchParameters($scope.query, $.extend({ }, $scope.filters));
    });

});

app.controller('SidebarCtrl',function($scope, $rootScope, $stateParams, MATCHER_IDS) {

    if (!$scope.filters) $rootScope.filters = filters;

    $scope.$watch('filters',function(filters) {
        if (!filters || Object.keys(filters).length === 0) return;
        $scope.table.parameters = CharUtils.generateSearchParameters($stateParams.query, $.extend({ }, $scope.filters));
        // build regexes if necessary
        $scope.table.regexes = { };
        if (filters.custom[MATCHER_IDS['special.OrbControllers']] && $scope.table.parameters.filters.ctrlFrom) {
            $scope.table.regexes.ctrlFrom = $scope.table.parameters.filters.ctrlFrom.split(',').map(function(x) {
                return new RegExp('Changes[^,]+\\[' + x + '\\][^,]+into','i');
            });
        } if (filters.custom[MATCHER_IDS['special.OrbControllers']] && $scope.table.parameters.filters.ctrlTo) {
            $scope.table.regexes.ctrlTo = $scope.table.parameters.filters.ctrlTo.split(',').map(function(x) {
                return new RegExp('Changes.+into[^,]+\\[' + x + '\\]','i');
            });
        } if (filters.custom[MATCHER_IDS['captain.ClassBoostingCaptains']] && $scope.filters.classCaptain) {
            $scope.table.regexes.classCaptain = new RegExp('of ' + $scope.filters.classCaptain + ' .*characters');
        } if (filters.custom[MATCHER_IDS['special.ClassBoostingSpecials']] && $scope.filters.classSpecial) {
            $scope.table.regexes.classSpecial = new RegExp('of ' + $scope.filters.classSpecial + ' .*characters');
        }
        // redraw table
        if (!$scope.$$phase) $scope.$apply();
    },true);

    $scope.clearFilters = function() {
        filters = { custom: [ ], classes: [ ], stars: [ ] };
        $scope.filters = { custom: [ ], classes: [ ], stars: [ ] };
    };

    $scope.onFilterClick = function(e, value) {
        var type = e.target.getAttribute('ng-model').split(/\./)[1];
        $scope.filters[type] = ($scope.filters[type] == value ? null : value);
    };

    $scope.onClassClick = function(e, clazz) {
        if ($scope.filters.classes.indexOf(clazz) == -1) {
            $scope.filters.classes = $scope.filters.classes.slice(0,1);
            $scope.filters.classes.push(clazz);
        }
        else $scope.filters.classes.splice($scope.filters.classes.indexOf(clazz), 1);
    };

    $scope.onStarsClick = function(e, stars) {
        if ($scope.filters.stars.indexOf(stars) == -1) $scope.filters.stars.push(stars);
        else $scope.filters.stars.splice($scope.filters.stars.indexOf(stars), 1);
    };

    $scope.onDropFilterClick = function(e,value) {
        var tokens = e.target.getAttribute('ng-model').split(/\./).slice(1);
        var type = tokens[0], key = tokens[1];
        if (!$scope.filters.hasOwnProperty(type)) $scope.filters[type] = { };
        $scope.filters[type][key] = ($scope.filters[type][key] == value ? null : value);
    };

    $scope.filterData = window.matchers;

    $scope.repeat = function(n) {
        return (n < 1 ? [ ] : new Array(n));
    };

});

app.controller('DetailsCtrl',function($scope, $rootScope, $state, $stateParams, $timeout) {
    // data
    var id = parseInt($stateParams.id, 10);
    $scope.id = id;
    $scope.unit = $.extend({},window.units[id - 1]);
    $scope.hybrid = $scope.unit.class && $scope.unit.class.constructor == Array;
    $scope.details = window.details[id];
    $scope.cooldown = window.cooldowns[id - 1];
    $scope.evolution = window.evolutions[id];
    // derived data
    var evolvesFrom = CharUtils.searchBaseForms(id);
    $scope.evolvesFrom = [ ];
    for (var from in evolvesFrom) {
        for (var i=0;i<evolvesFrom[from].length;++i)
            $scope.evolvesFrom.push({ from: parseInt(from, 10), to: $scope.id, via: evolvesFrom[from][i] });
    }
    $scope.usedBy = CharUtils.searchEvolverEvolutions(id);
    $scope.drops = CharUtils.searchDropLocations(id);
    $scope.tandems = CharUtils.searchTandems(id);
    $scope.manuals = CharUtils.searchDropLocations(-id);
    $scope.sameSpecials = CharUtils.searchSameSpecials(id);
    $scope.collapsed = { to: true, from: true, used: true, drops: true, manuals: true }; 
    // events/functions
    $scope.getEvos = CharUtils.getEvolversOfEvolution;
    $scope.sizeOf = function(target) { return Object.keys(target).length; };
    $scope.withButton = $stateParams.previous.length > 0;
    $scope.onBackClick = function() {
        var previous = $stateParams.previous.splice(-1)[0];
        $state.go('main.search.view',{ id: previous, previous: $stateParams.previous });
    };
    $scope.clearComparison = function() {
        $scope.compare = null;
        $('#compare').val('');
        $('#compare').prop('disabled', false);
    };
    $scope.getPrevious = function() { return $stateParams.previous.concat($scope.id); };
    $scope.isSpecialArray = ($scope.details && $scope.details.special && $scope.details.special.constructor == Array);
    // radar
    if ($scope.unit.incomplete) return;
    $scope.radar = {
        labels: [ 'HP', 'ATK', 'RCV' ],
        data: [ [
            $scope.unit.maxHP / 4000 * 100,
            $scope.unit.maxATK / 1500 * 100,
            Math.max(0, $scope.unit.maxRCV / 550 * 100)
        ] ],
        options: {
            scaleOverride: true,
            scaleSteps: 10,
            scaleStepWidth: 10,
            sclaeStartValue: 0,
            tooltipTemplate: '<%= Math.round(value * { HP: 4000, ATK: 1500, RCV: 550 }[label] / 100) + " " + label %>',
            multiTooltipTemplate: '<%= Math.round(value * { HP: 4000, ATK: 1500, RCV: 550 }[label] / 100) %>'
        }
    };
    $scope.$watch('compare',function(compare) {
        $scope.radar.data = $scope.radar.data.slice(0,1);
        if (compare) {
            $scope.radar.data.push([
                $scope.compare.maxHP / 4000 * 100,
                $scope.compare.maxATK / 1500 * 100,
                Math.max(0, $scope.compare.maxRCV / 550 * 100)
            ]);
        }
        if (!$scope.$$phase) $scope.$apply();
    });
});

app.controller('ColumnsCtrl',function($scope, $rootScope, $state, $stateParams) {

    $scope.columns = { 'HP/ATK': false, 'HP/RCV': false, 'ATK/RCV': false, 'ATK/CMB': false,
        'CMB': false, 'ATK/cost': false, 'HP/cost': false, 'Minimum cooldown': false,
        'Initial cooldown': false };

    var additionalColumns = JSON.parse(localStorage.getItem('charColumns')) || [ ];

    additionalColumns.forEach(function(x) {
        if ($scope.columns.hasOwnProperty(x))
            $scope.columns[x] = true;
    });

    $scope.save = function() {
        var result = Object.keys($scope.columns).filter(function(x) { return $scope.columns[x]; });
        localStorage.setItem('charColumns',JSON.stringify(result));
        window.location.reload();
    };

});

})();
