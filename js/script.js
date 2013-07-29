// !Placeholders and HTML elements
var width = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth
	, height = window.innerHeight || document.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight
	, mindim = width < height ? width : height
	, pages = [{pageID: 'Entry', name:'Entry', views:0, category:'Site', type:'special', fixed:true, y:height/2}
	, 		{pageID: 'Exit', name:'Exit', views:0, category:'Site',  type:'special', fixed:true, y:height/2}]
	, pageMap = {'Entry':0,'Exit':1}
	, loopString = ' <> Loop'
	, nodes = []
	, nodeSessionMap = {}
	, paths = {}
	, pathKeys = {}
	, pairs = []
	, pairMap = {}
	, links = []
	, viewMax = 0
	, rideMax = 0
	, loopMax = 0
	, totalPageViews = 0
	, totalSessions = 0
	, viewsPerSession = []
	, scale = {}
	, format = {}
	, force = {}
	, state = {}
	, svg = d3.select('body').select('svg')
	  .attr('width', width)
	  .attr('height', height)
	, tooltip = d3.select('body').append('div')   
		.attr('id', 'tooltip')               
		.style('opacity', 0)
	, infobar = {}
;

// !Settings
var dataPath = 'tdw-m.tsv'
	, rideMin = 150
	, radiusMin = 3
	, radiusMax = mindim / 20
	, strokeMin = 0.5
	, strokeMax = 2
	, linkStrMin = 0.1
	, linkStrMax = 0.5
	, linkWidthMin = 1
	, linkWidthMax = radiusMax
	, linkMinOpac = 0.2
	, linkMaxOpac = 0.3
	, linkLowlightOpac = 0.1
	, linkHighlightOpac = 0.9
	, loopStrMin = 1
	, loopStrMax = 0.4
	, loopWidth = 0.75
	, nodeHiddenOpac = 0.25
	, paddingVertical = 0
	, paddingHorizontal = 0
	, gravity = .1
	, charge = -1000
	, infobarSize = 300
	, infobarSiteStats = 3
	, infobarPosition = 'right'
	, infobarPositionVal = infobarSize
	, infobarPageStats = 5
	, infobarSizeDim = 'width'
	, infobarMaxDim = 'height'
	, infobarDefaultText = 'TDW Usage Tuesday, 10-11am'
	, colors = ['#393b79', '#6b6ecf', '#637939', '#b5cf6b', '#8c6d31', '#e7ba52', '#843c39', '#d6616b', '#7b4173', '#ce6dbd']
	, tracer = {
		// traceSimultaneous, traceConsecutive, traceOne
		animation: traceOne
		, params: {
			speed: 1500
			, loop: true
			, delay: 3000
			, repeat: 400
			, autorun: false
		}
		, create: function(index) {
			return svg.append("circle")
				.attr("class", "tracer")
				.attr("r", 5)
				.attr("opacity", 0.8)
				.attr("fill", scale.color(index))
			;					
		}
	}
;
drawInfobar(infobar);
makeFormat(); 
pages[0].x = radiusMax + strokeMax + paddingHorizontal;
pages[1].x = width - radiusMax - strokeMax - paddingHorizontal;


// Get and process all of the data
d3.tsv(dataPath, function(error, data) {
	// !Collect and count pages (for nodes), collect paths, collect and counts pairs (for links)
	data.forEach(function(d, i) {
		var params = d;
		// Add the Entry node to the page paths if it doesn't exist
		if (!paths[d.sessID]) { 
			params.pageID = 'Entry'
			params.pageIndex = 0;
			addPageAndPath(params);
		}
		params.pageID = getPageID(d.PageCategory, d.PageName);
		params.pageIndex = pageMap[params.pageID] || -1;
		params.type = 'page';
		addPageAndPath(params);
		totalPageViews++;
	});

	// Construct a reference array for sessionIDs
	pathKeys = d3.keys(paths);
	totalSessions = pathKeys.length;

	// !Add the Exit node to all page paths
	pathKeys.forEach(function(sessID) {
		var params = {};
		params.sessID = sessID;
		params.pageID = 'Exit';
		params.pageIndex = 1;
		addPageAndPath(params);
		viewsPerSession.push(paths[sessID].length);
	});

	// Add pages and paths (convenience function)
	function addPageAndPath(params) {
		addPage(params);
		addPath(params);
		mapPage(params);
	}

	// Makes a record of every session that a page appears in
	function mapPage(params) {
		nodeSessionMap[params.pageID] = nodeSessionMap[params.pageID] || {};
		nodeSessionMap[params.pageID][params.sessID] = nodeSessionMap[params.pageID][params.sessID] + 1 || 1;
	}

	// Add the page if needed, increment views for the page
	function addPage(params) {
		if (params.pageIndex === -1 ) { 
			params.pageIndex = pages.push({pageID:params.pageID, name:params.PageName, category:params.PageCategory, type:params.type, views:0 }) - 1;
			pageMap[params.pageID] = params.pageIndex;
		}			
		pages[params.pageIndex].views++;
	}

	// Add page to path, call the pairs function
	function addPath(params) {
		var path, length, i = 0;
		if (!paths[params.sessID]) { paths[params.sessID] = []; }
		path = paths[params.sessID];
		path.push(params.pageID);
		length = path.length;
		if (length > 1) {
			params.pageIDPrev = path[length-2];
			addPair(params);
		}
	}

	// Add pair if needed, increment the 'rides' for the pair
	function addPair(params) {
		var pairName, pairIndex, sourceIndex;
		// Treat looped pages differently
		pairName = getPairName(params.pageIDPrev,params.pageID);
		if (params.pageIDPrev === params.pageID) {
			params.Page += loopString;
			params.pageID += loopString;
			params.pageIndex = pageMap[params.pageID] || -1;
			params.type = 'loop';
			addPage(params);
		} else {
			params.type = 'pair';
		}
		pairIndex = pairMap[pairName] || -1;
		if (pairIndex === -1) {
			sourceIndex = pageMap[params.pageIDPrev];
			pairIndex = pairs.push({source:sourceIndex, target:params.pageIndex, type:params.type, rides:0}) - 1;
			pairMap[pairName] = pairIndex;
		}
		pairs[pairIndex].rides++;
	}

	// !Calculate maximum page views (nodes) and 'rides' (links)
	viewMax = d3.max(pages, function(d) { return d.views; });
	rideMax = d3.max(pairs, function(d) { return d.rides; });
	loopMax = d3.max(pairs, function(d) { if (d.type === 'loop') return d.rides; });

	// Does what it says
	makeScales();

	// Creates force, nodes, links
	drawVis();
	
	// Start the tracer animation
	if (tracer.animation) { tracer.animation(tracer.params); }
	
	// Calculate the stats for every page
	pages.forEach(function(page, i) {
		pages[i].stats = pageStats(page);
	}) 
	
	fillSiteStats();

});

function makeScales() {
	// !Scales
	scale.radius = d3.scale.sqrt()
		.domain([1,viewMax])
		.range([radiusMin, radiusMax])
	;

	scale.color = d3.scale.ordinal()
		.range(colors)
	;
	
	scale.strokeWidth = d3.scale.sqrt()
		.domain([1,viewMax])
		.range([strokeMin, strokeMax])
	;
	
	scale.linkStr = d3.scale.sqrt()
		.domain([1,rideMax])
		.range([linkStrMin, linkStrMax])
	;
	
	scale.linkWidth = d3.scale.sqrt()
		.domain([1, rideMax])
		.range([linkWidthMin, linkWidthMax])
	;
	
	scale.linkOpacity = d3.scale.sqrt()
		.domain([1, rideMin, rideMax])
		.range([0, linkMinOpac,linkMaxOpac])
	;
	
	scale.loopStr = d3.scale.sqrt()
		.domain([1,loopMax])
		.range([loopStrMin, loopStrMax])
	;
}

function makeFormat() {
	format.comma = d3.format(',g');
	format.round = d3.format(',.3r');
	format.percent = d3.format('.1%')
}

// Creates force, nodes, links
function drawVis() {
	// !Create force layout, nodes (pages), links (pairs)
	force = d3.layout.force()
		.gravity(gravity)
		.charge(charge)
		.size([width, height])
		.nodes(pages)
		.links(pairs)
		.linkStrength(function(d) { 
			if (d.type === 'loop') { 
				return scale.loopStr(d.rides);
			} else { 
				return scale.linkStr(d.rides);
			}
		})
		.start()
	;

	links = svg.selectAll('.link')
		.data(pairs)
		.enter()
		.append('path')
			.attr('class', 'link')
			.style('stroke-width', function(d) { return scale.linkWidth(d.rides); })
			.style('stroke-opacity', function(d) { return scale.linkOpacity(d.rides); })
	;

	// Draw nodes after links to put them on top
	nodes = svg.selectAll('.node')
		.data(pages)
		.enter().append('circle')
			.attr('class', function(d) { if (d.type !== 'loop') { return 'node' } else { return 'node-loop'; } })
			.attr('r', function(d) { return scale.radius(d.views); } )
			.style('stroke', function(d) { return scale.color(d.category); })
			.style('stroke-width', function(d) { return scale.strokeWidth(d.views); })
			.on('mouseover', function(d) { nodeHighlight(d); })
			.on('mouseout', function(d) { nodeReset(d); })
//			.call(force.drag)
		;

	// !Update links and nodes on force 'tick'
	force.on('tick', function() {
	  links.attr('d', function(d) {
			var rise = d.source.y - d.target.y
				, run = d.source.x - d.target.x
				, cxTarget, cyTarget, controlX1, controlX2, controlY1, controlY2
			;

			if (d.type === 'loop') {
				cxTarget = d.target.x - (run / 3)
				cyTarget = d.target.y -  (rise / 3)
				controlX1 = cxTarget + (loopWidth * rise)
				controlY1 = cyTarget - (loopWidth * run)
				controlX2 = cxTarget - (loopWidth * rise)
				controlY2 = cyTarget + (loopWidth * run)

				return 'M' + d.source.x + ',' + d.source.y
					+ ' C' + controlX1 + ',' + controlY1
					+ ' ' + controlX2 + ',' + controlY2
					+ ' ' + d.source.x + ',' + d.source.y

			} else {
				controlX1 = d.target.x + (run / 2) + (rise / 2);
				controlY1 = d.target.y + (rise / 2) + (run / 2);
				return 'M' + d.source.x + ',' + d.source.y
					+ ' S' + controlX1 + ',' + controlY1
					+ ' ' + d.target.x + ',' + d.target.y
			}
		});

		// Quadtree for collisions
		var q = d3.geom.quadtree(pages)
			, i = 2
			, n = pages.length
		;

		while (++i < n) q.visit(collide(pages[i]));

		// !Keep nodes inside viewport
		nodes
		    .attr('cx', function(d) { return d.x = Math.max(scale.radius(d.views) + paddingHorizontal, Math.min(width - scale.radius(d.views) - paddingHorizontal, d.x)); })
		    .attr('cy', function(d) { return d.y = Math.max(scale.radius(d.views) + paddingVertical, Math.min(height - scale.radius(d.views) - paddingVertical, d.y)); });
	  });

	
}

function drawInfobar(infobar) {
	infobar.main = d3.select('body').append('div')
		.attr('id', 'infobar')
		.style(infobarPosition, 0)
		.style(infobarMaxDim, '100%')
		.style(infobarSizeDim, infobarSize + 'px')
	;
	if (infobarPosition === 'top' || infobarPosition === 'bottom') {
		height -= infobarSize;
	} else {
		width -= infobarSize;
		infobar.main.style('top', 0)
	}

	infobar.title = infobar.main.append('div')
		.attr('class', 'infobar-title')

	infobar.siteStats = [];
	for (var i = 0; i < infobarSiteStats; i++) {
		makeStats(infobar.siteStats, i);
	}

	infobar.pageStats = [];
	infobar.pageTitle = infobar.main.append('div')
		.attr('class', 'infobar-page-title')
	
	for (var i = 0; i < infobarPageStats; i++) {
		makeStats(infobar.pageStats, i);
	}
	infobar.title.text(infobarDefaultText);

	function makeStats(location, i) {
		location[i] = {};
		location[i].main = infobar.main.append('div')
			.attr('class', 'infobar-stat')
		;
		location[i].number = location[i].main.append('div')
			.attr('class', 'infobar-number')
		;
		location[i].descr = location[i].main.append('div')
			.attr('class', 'infobar-description')
		;
	}	
}

function fillSiteStats() {
	infobar.siteStats[0].number.text(format.comma(totalPageViews))
	infobar.siteStats[0].descr.text('Total Pages Viewed')
	
	infobar.siteStats[1].number.text(format.round(totalPageViews / totalSessions))
	infobar.siteStats[1].descr.text('Average Pages / Session')

	infobar.siteStats[2].number.text(format.comma(totalSessions))
	infobar.siteStats[2].descr.text('Total Sessions')
}

function fillPageStats(page) {
	
	infobar.pageTitle.html('<span class="category">' + page.category + '</span> <span class="name">' + page.name + '</span>');

	infobar.pageStats[0].number.html(format.comma(page.views) + ' <span class="percent">(' + format.percent(page.stats.percentOfPages) + ')</span>');
	infobar.pageStats[0].descr.text('Page Views');
	
	infobar.pageStats[1].number.html(format.comma(page.stats.sessions) + ' <span class="percent">(' + format.percent(page.stats.percentOfSessions) + ')</span>');
	infobar.pageStats[1].descr.text('Sessions');
	
	infobar.pageStats[2].number.html(format.round(page.stats.pagesPerSession) + ' <span class="percent">(' + format.percent(page.stats.percentOfSession) + ')</span>');
	infobar.pageStats[2].descr.text('Pages / Session');
	
	infobar.pageStats[3].number.html('<span class="comes-from">' + format.percent(page.stats.comesFromPercent) + '</span>')
	infobar.pageStats[3].descr.html('Coming From <span class="category">' + page.stats.comesFromCategory + '</span> <span class="name">' + page.stats.comesFromName + '</span>');
	
	infobar.pageStats[4].number.html('<span class="goes-to">' + format.percent(page.stats.goesToPercent) + '</span>')
	infobar.pageStats[4].descr.html('Going To <span class="category">' + page.stats.goesToCategory + '</span> <span class="name">' + page.stats.goesToName + '</span>');
	
/*
	infobar.pageStats[3].number.html('<span class="name">' + page.stats.comesFrom + '</span>')
	infobar.pageStats[3].descr.html('<span class="comes-from">Coming From (' + format.percent(page.stats.comesFromPercent) + ')</span>');
	
	infobar.pageStats[4].number.html('<span class="name">' + page.stats.goesTo + '</span>')
	infobar.pageStats[4].descr.html('<span class="goes-to">Going To (' + format.percent(page.stats.goesToPercent) + ')</span>');
	
*/

}

function clearPageStats() {
	infobar.pageTitle.text('');
	for (var i = 0; i < infobarPageStats; i++) {
		infobar.pageStats[i].number.text('');
		infobar.pageStats[i].descr.text('');
	}
	
}

// Highlight links, fade nodes, show tooltip
function nodeHighlight(node) {
	state.selectedNodeID = node.pageID;
	node.state = 'selected';
	node.fixed = true;
	
	fillPageStats(node);

	// Highlight all links that touch
    var linkedNodes = {};
    linkedNodes[node.index] = true;
    links
			.attr('class', function(d) {
				if (d.source.index === node.index) { 
					linkedNodes[d.target.index] = true;
					d.state = 'source';
					if (d.type === 'loop') { return 'loop-selected'; }
					else { return 'link-source'; }
				} 
				if (d.target.index === node.index) { 
					linkedNodes[d.source.index] = true;
					d.state = 'target';
					return 'link-target';
				}
				return 'link';
			})

			.style('stroke-opacity', function(d) {
				if (d.source.index === node.index || d.target.index === node.index) { 
					return linkHighlightOpac; 
				} else { 
					return scale.linkOpacity(d.rides) * linkMinOpac; 
				}
			});

	// Fade out any nodes not connected
	nodes
		.style('opacity', function(d) {
			if (!linkedNodes[d.index]) { 
				return nodeHiddenOpac; 
			}
		});
}


// Return links and nodes to original state, hide tooltip
function nodeReset(node) {
		state.selectedNodeID = false;
    node.state = 'normal';
    clearPageStats();
    
    if (node.type !== 'special') { node.fixed = false; }
    links
			.style('stroke-opacity', function(d) { 
				d.state = 'normal';
				return scale.linkOpacity(d.rides); 
			})
    	.attr('class', 'link');
    nodes
    	.style('opacity', 1);

	tooltip
		.transition()        
		.duration(500)      
		.style('opacity', 0);   
}


// Collision function copied directly from Bostock examples http://bl.ocks.org/mbostock/3231298
function collide(node) {
	var r = scale.radius(node.views) + 15
		, nx1 = node.x - r
		, nx2 = node.x + r
		, ny1 = node.y - r
		, ny2 = node.y + r
	;

	return function(quad, x1, y1, x2, y2) {
		if (quad.point && (quad.point !== node)) {
			var x = node.x - quad.point.x
				, y = node.y - quad.point.y
				, l = Math.sqrt(x * x + y * y)
				, r = scale.radius(node.views) + scale.radius(quad.point.views)
			;
			if (l < r) {
				l = (l - r) / l * 0.5;
				node.x -= x *= l;
				node.y -= y *= l;
				quad.point.x += x;
				quad.point.y += y;
			}
		}
		return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
	};
}


function getPageID(category,page) {
	return category + ' > ' + page;
}


function getPairName(page1,page2) {
	if (page1 === page2) {
		return page1 + loopString;
	} else { return page1 + ' & ' + page2; }
	
}


// params = { loop:boolean, speed:milliseconds, delay:milliseconds }
function traceOne(params) {
		setTimeout(function(){
			setInterval(function() {
				params.pathIndex = params.pathIndex && params.pathIndex < pathKeys.length ? params.pathIndex : 0;
				if ((params.autorun || state.selectedNodeID) && !params.pause) { 
					if (state.selectedNodeID) {
						params.sessIndex = params.sessIndex || 0;
						params.sessKeys = d3.keys(nodeSessionMap[state.selectedNodeID]);
						if (params.sessIndex >= params.sessKeys.length) {
							params.sessIndex = 0;
							params.pause = true;
							setTimeout(function() { params.pause = false; }, 2 * params.delay)
							return false;	
						}
						params.sessID = params.sessKeys[params.sessIndex];
						params.sessIndex++;
					} else {
						params.sessID = pathKeys[params.pathIndex]
						params.pathIndex++;
					}
					traverseSession({
						session: paths[params.sessID]
						, transitionCallback: traverseSession
						, tracer: tracer.create(params.sessID)
						, duration: params.speed
					});
				}
			}, params.repeat);
		}, params.delay);
}

// Simultaneously launches all the tracers.	 Use only in case of emergency.
// params = { loop, speed }
function traceSimultaneous(params) {
	d3.keys(paths).forEach(function(d, i){
		if (params.loop) { params.sessionCallback = traverseSession; }
		setTimeout(function() {
			traverseSession({
				session: paths[d]
				, sessionCallback: params.sessionCallback
				, transitionCallback: traverseSession
				, tracer: tracer.create()
				, duration: params.speed
			});
		}, params.delay);
	});
}


// Go through each of the sessions in paths, one at a time, designed to be re-called after walking a session to move to the next path
// params = { pathMap, paths, pathIndex }
function traversePath(params) {
	if (!params.pathIndex) { params.pathIndex = 0; }
	if (params.pathIndex >= params.pathMap.length) { 
		if(params.loop) { 
		params.pathIndex = 0;
		} else { return false; }
	}
	params.session = params.paths[params.pathMap[params.pathIndex]];
	traverseSession(params);
	params.pathIndex++;
}


// Go through each link in a session, one at a time, designed to be re-called after tracing a link to move to the next link
// params = { session, sessionIndex, sessionCallback }
function traverseSession(params) {
	if (!params.session) { console.log }
	if (state.selectedNodeID && params.session.indexOf(state.selectedNodeID) === -1 && params.sessionIndex < params.session.length - 2) {
		params.sessionIndex = params.session.length - 1;
	}
	if (!params.sessionIndex) { params.sessionIndex = 0; }
	if (params.sessionIndex + 1 >= params.session.length) { 
				params.sessionIndex = 0;
				params.tracer.remove();
				if (params.sessionCallback) { 
					params.sessionCallback(params); 
				}
	} else {
		var linkName = getPairName(params.session[params.sessionIndex],params.session[params.sessionIndex+1])
			, linkIndex = pairMap[linkName]
		;
		params.link = links[0][linkIndex];
		traceLink(params);
		params.sessionIndex++;
	}
}


// Traces the link using translateAlong
// params = { link, tracer, transitionCallback }
function traceLink(params) {
	if (!params.duration) { params.duration = 1000; }
	params.tracer.transition()
		.duration(params.duration)
		.attrTween("transform", function() { return translateAlong(params.link); })
		.each("end", function() { 
			if (params.transitionCallback) { params.transitionCallback(params); }
		});
}


// Returns an attrTween for translating along the specified path element.
function translateAlong(path) {
		return function(t) {
		 var l = path.getTotalLength(),
					p = path.getPointAtLength(t * l);
			return "translate(" + p.x + "," + p.y + ")";
		};
}

// Returns the average pages per session for a given page in only those sessions in which it appears.
function pageStats(page) {
	var sessions = nodeSessionMap[page.pageID]
		, sessionKeys = d3.keys(sessions)
		, allPagesTotal = 0
		, thisPageTotal = 0
		, comesFromMax = 0
		, comesFromIndex = 0
		, goesToMax = 0
		, goesToIndex = 0
		, loopRides = 0
		, stats = {}
	;
	sessionKeys.forEach(function(sessionID) {
		allPagesTotal += paths[sessionID].length;
		thisPageTotal += sessions[sessionID];
	});
	
	pairs.forEach(function(d, i){
		if (page.index === d.source.index) {
			if (d.type != 'loop') {
				if (d.rides > goesToMax) {
					goesToMax = d.rides;
					goesToIndex = d.target.index;
				} 
			} else {
				loopRides = d.rides;
			}
		} else if (page.index === d.target.index) {
			if (d.rides > comesFromMax) {
				comesFromMax = d.rides;
				comesFromIndex = d.source.index;
			} 
		}
	});
	
	stats.sessions = sessionKeys.length;
	stats.percentOfPages = page.views / totalPageViews;
	stats.percentOfSessions = stats.sessions / totalSessions;
	stats.pagesPerSession = thisPageTotal / sessionKeys.length;
	stats.percentOfSession = thisPageTotal / allPagesTotal;
	stats.comesFromCategory = pages[comesFromIndex].category;
	stats.comesFromName = pages[comesFromIndex].name;
	stats.comesFromRides = comesFromMax;
	stats.comesFromPercent = comesFromMax / page.views;
	stats.goesToCategory = pages[goesToIndex].category;
	stats.goesToName = pages[goesToIndex].name;
	stats.goesToRides = goesToMax;
	stats.goesToPercent = goesToMax / page.views;
	stats.loopRides = loopRides;
	stats.loopRidesPercent = loopRides / thisPageTotal;

	return stats;
}
