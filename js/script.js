/*

Bugs
• Let all tracers run their course before resuming
• Fix infobar stats for site entry and exit (don't show entry and exit for those pages)
• Show loop percentage


Small
• Page labels on highlight
• Key - Size, color, links
• Static Entry/Exit node color


Medium
• Rearrange nodes by category
• Jitter for tracer landing/takeoff
• Tracers impact nodes


Large
• Incorporate timestamp to tracer movement
• Click to focus on a single node
• Draw link paths as tracers go, increase width with each subsequent tracer, use opacity for width values < 1

*/

var dv = {
	dim: {
			w: window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth
		, h: window.innerHeight || document.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight
	}
	, svg: {
			nodes: []
		, links: []
	}
	, data: {
			pages: []
		,	pairs: []
		, paths: {}
		, pathKeys: {}
		, viewsPerSession: []
		, max: {}
		, total: {
				views: 0
			, sessions: 0
		}
	}
	, map: {
			pages: { 'Entry':0, 'Exit':1 }
		, pairs: {}
		, paths: {}
		, nodeSession: {}
	}
	, get: {}
	, setup: {}
	, create: {}
	, update: {}
	, calc: {}
	, draw: {}
	, clear: {}
	, util: {}
	, scale: {}
	, format: {}
	, force: {}
	, state: {}
	, infobar: {}
}

dv.setup.vars = function() {
	dv.dim.min = dv.dim.w < dv.dim.h ? dv.dim.w : dv.dim.h;
	
	dv.data.pages = [
			{ pageID: 'Entry', name: 'Entry', views: 0, category: 'Site', type: 'special', fixed: true, y: dv.dim.h/2 }
		, { pageID: 'Exit', name: 'Exit', views: 0, category: 'Site',  type: 'special', fixed: true, y: dv.dim.h/2 }
	];
	
	dv.svg.main = d3.select('body').select('svg')
	  .attr('width', dv.dim.w)
	  .attr('height', dv.dim.h)
	;
}

dv.setup.options = function() {
	dv.o = {
			data: 'tdw-m.tsv'
		, page: {
				pad: {
					vertical: 0
				, horizontal: 0
			}
		}
		, node: {
				opac: {
					hide: 0.25
			}
			, radius: {
					min: 3
				, max: dv.dim.min / 20
			}
			, stroke: {
					min: 0.5
				, max: 2
			}
			, layout: 'force'
		}
		, link: {
				value: {
					min: 150
			}
			, strength: {
					min: 0.1
				, max: 0.5
			}
			, width: {
					min: 1
				, max: dv.dim.min / 20
			}
			, opac: {
					norm: {
						min: 0.2
					, max: 0.3
				}
				, hide: 0.1
				, highlight: 0.9
			}
		}
		, loop: {
				strength: {
						min: 1
					, max: 0.4
				}
			, width: 0.75
			, string: ' <> Loop'
		}
		, force: {
				gravity: 1
			, charge: -1000
		}
		, infobar: {
				size: 300
			, stats: {
					site: 3
				, page: 5
			}
			, position: {
					side: 'right'
				, value: 300
			}
			, dim: {
					size: 'width'
				, max: 'height'
			}
			, text: 'TDW Usage Tuesday, 10-11am'
		}
		, colors: ['#393b79', '#6b6ecf', '#637939', '#b5cf6b', '#8c6d31', '#e7ba52', '#843c39', '#d6616b', '#7b4173', '#ce6dbd']
		, tracer: {
				// traceConsecutive, traceOne
				animation: dv.util.traceOne
			, params: {
					speed: 1500
				, loop: true
				, delay: 3000
				, repeat: 400
				, autorun: false
			}
			, create: function(sessID) {
					var name = dv.data.paths[sessID][1]
						,	index = dv.map.pages[name]
						, page = dv.data.pages[index]
					;
					return dv.svg.main.append("circle")
						.attr("class", "tracer")
						.attr("r", 5)
						.attr("opacity", 0.8)
						//.attr("fill", dv.scale.color(sessID))
						//.attr("fill", '#fc0')
						.attr("fill", dv.scale.color(page.category))
					;					
			}
		}
	}
}

dv.setup.withoutData = function() {
	dv.setup.vars();
	dv.setup.options();
	dv.draw.infobar();
	dv.update.positions();
	dv.create.formats();
	dv.get.data();
}

dv.setup.withData = function() {
	dv.create.scales();
	dv.get.stats();
	dv.draw.vis();
	dv.draw.siteStats();

	// Start the tracer animation
	if (dv.o.tracer.animation) { dv.o.tracer.animation(dv.o.tracer.params); }
}

// Get and process all of the data
dv.get.data = function() {
	d3.tsv(dv.o.data, function(error, data) {
		// !Collect and count pages (for nodes), collect paths, collect and counts pairs (for links)
		data.forEach(function(d, i) {
			var params = d;
			// Add the Entry node to the page paths if it doesn't exist
			if (!dv.data.paths[d.sessID]) { 
				params.pageID = 'Entry'
				params.pageIndex = 0;
				addPageAndPath(params);
			}
			params.pageID = dv.get.pageID(d.PageCategory, d.PageName);
			params.pageIndex = dv.map.pages[params.pageID] || -1;
			params.type = 'page';
			addPageAndPath(params);
			dv.data.total.views++;
		});
	
		// Construct a reference array for sessionIDs
		dv.data.pathKeys = d3.keys(dv.data.paths);
		dv.data.total.sessions = dv.data.pathKeys.length;
	
		// !Add the Exit node to all page paths
		dv.data.pathKeys.forEach(function(sessID) {
			var params = {};
			params.sessID = sessID;
			params.pageID = 'Exit';
			params.pageIndex = 1;
			addPageAndPath(params);
			dv.data.viewsPerSession.push(dv.data.paths[sessID].length);
		});
	
		// Add pages and paths (convenience function)
		function addPageAndPath(params) {
			addPage(params);
			addPath(params);
			mapPage(params);
		}
	
		// Makes a record of every session that a page appears in
		function mapPage(params) {
			dv.map.nodeSession[params.pageID] = dv.map.nodeSession[params.pageID] || {};
			dv.map.nodeSession[params.pageID][params.sessID] = dv.map.nodeSession[params.pageID][params.sessID] + 1 || 1;
		}
	
		// Add the page if needed, increment views for the page
		function addPage(params) {
			if (params.pageIndex === -1 ) { 
				params.pageIndex = dv.data.pages.push({pageID:params.pageID, name:params.PageName, category:params.PageCategory, type:params.type, views:0 }) - 1;
				dv.map.pages[params.pageID] = params.pageIndex;
			}			
			dv.data.pages[params.pageIndex].views++;
		}
	
		// Add page to path, call the pairs function
		function addPath(params) {
			var path, length, i = 0;
			if (!dv.data.paths[params.sessID]) { dv.data.paths[params.sessID] = []; }
			path = dv.data.paths[params.sessID];
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
			pairName = dv.get.pairName(params.pageIDPrev,params.pageID);
			if (params.pageIDPrev === params.pageID) {
				params.Page += dv.o.loop.string;
				params.pageID += dv.o.loop.string;
				params.pageIndex = dv.map.pages[params.pageID] || -1;
				params.type = 'loop';
				addPage(params);
			} else {
				params.type = 'pair';
			}
			pairIndex = dv.map.pairs[pairName] || -1;
			if (pairIndex === -1) {
				sourceIndex = dv.map.pages[params.pageIDPrev];
				pairIndex = dv.data.pairs.push({source:sourceIndex, target:params.pageIndex, type:params.type, rides:0}) - 1;
				dv.map.pairs[pairName] = pairIndex;
			}
			dv.data.pairs[pairIndex].rides++;
		}
	
		// !Calculate maximum page views (nodes) and 'rides' (links)
		dv.data.max.views = d3.max(dv.data.pages, function(d) { return d.views; });
		dv.data.max.rides = d3.max(dv.data.pairs, function(d) { return d.rides; });
		dv.data.max.loops = d3.max(dv.data.pairs, function(d) { if (d.type === 'loop') return d.rides; });
	
		dv.setup.withData();
	});
}

dv.get.pageID = function(category,page) {
	return category + ' > ' + page;
}

dv.get.pairName = function(page1,page2) {
	if (page1 === page2) {
		return page1 + dv.o.loop.string;
	} else { return page1 + ' & ' + page2; }
	
}

dv.get.stats = function() {
	dv.data.pages.forEach(function(page, i) {
		dv.data.pages[i].stats = dv.get.pageStats(page);
	}) 
}

// Returns the average pages per session for a given page in only those sessions in which it appears.
dv.get.pageStats = function(page) {
	var sessions = dv.map.nodeSession[page.pageID]
		, sessionKeys = d3.keys(sessions)
		, sessionKeysLength = sessionKeys.length
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
		allPagesTotal += dv.data.paths[sessionID].length;
		thisPageTotal += sessions[sessionID];
	});
	
	dv.data.pairs.forEach(function(d, i){
		if (page.index === d.source.index) {
			if (d.type != 'loop') {
				if (d.rides > goesToMax) {
					goesToMax = d.rides;
					goesToIndex = d.target;
				} 
			} else {
				loopRides = d.rides;
			}
		} else if (page.index === d.target.index) {
			if (d.rides > comesFromMax) {
				comesFromMax = d.rides;
				comesFromIndex = d.source;
			} 
		}
	});
	
	stats = {
			sessions: sessionKeysLength
		,	percent: {
				pages: page.views / dv.data.total.views
			, sessions: sessionKeysLength / dv.data.total.sessions
		}
		,	session: {
				pagesPer: thisPageTotal / sessionKeys.length
			,	percentOf: thisPageTotal / allPagesTotal
		}
		,	from: {
				category: dv.data.pages[comesFromIndex].category
			,	name: dv.data.pages[comesFromIndex].name
			,	rides: comesFromMax
			,	percent: comesFromMax / page.views
		}
		, to: {
				category: dv.data.pages[goesToIndex].category
			,	name: dv.data.pages[goesToIndex].name
			,	rides: goesToMax
			,	percent: goesToMax / page.views
		}
		,	loop: {
				rides: {
					total: loopRides
				, percent: loopRides / thisPageTotal
			}
		}
	}
	
	return stats;
}

dv.update.positions = function() {
	dv.data.pages[0].x = dv.o.node.radius.max + dv.o.node.stroke.max + dv.o.page.pad.horizontal;
	dv.data.pages[1].x = dv.dim.w - dv.o.node.radius.max - dv.o.node.stroke.max - dv.o.page.pad.horizontal;
}

dv.create.scales = function() {
	// !Scales
	dv.scale.radius = d3.scale.sqrt()
		.domain([1,dv.data.max.views])
		.range([dv.o.node.radius.min, dv.o.node.radius.max])
	;

	dv.scale.color = d3.scale.ordinal()
		.range(dv.o.colors)
	;
	
	dv.scale.strokeWidth = d3.scale.sqrt()
		.domain([1,dv.data.max.views])
		.range([dv.o.node.stroke.min, dv.o.node.stroke.max])
	;
	
	dv.scale.linkStr = d3.scale.sqrt()
		.domain([1,dv.data.max.rides])
		.range([dv.o.link.strength.min, dv.o.link.strength.max])
	;
	
	dv.scale.linkWidth = d3.scale.sqrt()
		.domain([1, dv.data.max.rides])
		.range([dv.o.link.width.min, dv.o.link.width.max])
	;
	
	dv.scale.linkOpacity = d3.scale.sqrt()
		.domain([1, dv.o.link.value.min, dv.data.max.rides])
		.range([0, dv.o.link.opac.norm.min,dv.o.link.opac.norm.max])
	;
	
	dv.scale.loopStr = d3.scale.sqrt()
		.domain([1,dv.data.max.loops])
		.range([dv.o.loop.strength.min, dv.o.loop.strength.max])
	;
}

dv.create.formats = function() {
	dv.format.comma = d3.format(',g');
	dv.format.round = d3.format(',.3r');
	dv.format.percent = d3.format('.1%')
}

// Creates force, nodes, links
dv.draw.vis = function() {
	// !Create force layout, nodes (pages), links (pairs)
	dv.force = d3.layout.force()
		.gravity(dv.o.force.gravity)
		.charge(dv.o.force.charge)
		.size([dv.dim.w, dv.dim.h])
		.nodes(dv.data.pages)
		.links(dv.data.pairs)
		.linkStrength(function(d) { 
			if (d.type === 'loop') { 
				return dv.scale.loopStr(d.rides);
			} else { 
				return dv.scale.linkStr(d.rides);
			}
		})
		.start()
	;

	dv.svg.links = dv.svg.main.selectAll('.link')
		.data(dv.data.pairs)
		.enter()
		.append('path')
			.attr('class', 'link')
			.style('stroke-width', function(d) { return dv.scale.linkWidth(d.rides); })
			.style('stroke-opacity', function(d) { return dv.scale.linkOpacity(d.rides); })
	;

	// Draw nodes after links to put them on top
	dv.svg.nodes = dv.svg.main.selectAll('.node')
		.data(dv.data.pages)
		.enter().append('circle')
			.attr('class', function(d) { if (d.type !== 'loop') { return 'node' } else { return 'node-loop'; } })
			.attr('r', function(d) { return dv.scale.radius(d.views); } )
			.style('stroke', function(d) { return dv.scale.color(d.category); })
			.style('stroke-width', function(d) { return dv.scale.strokeWidth(d.views); })
			.on('mouseover', function(d) { dv.draw.nodeHighlight(d); })
			.on('mouseout', function(d) { dv.clear.nodeHighlight(d); })
//			.call(dv.force.drag)
		;

	// !Update links and nodes on force 'tick'
	dv.force.on('tick', function() {
	  dv.svg.links.attr('d', function(d) {
			var rise = d.source.y - d.target.y
				, run = d.source.x - d.target.x
				, cxTarget, cyTarget, controlX1, controlX2, controlY1, controlY2
			;

			if (d.type === 'loop') {
				cxTarget = d.target.x - (run / 3)
				cyTarget = d.target.y -  (rise / 3)
				controlX1 = cxTarget + (dv.o.loop.width * rise)
				controlY1 = cyTarget - (dv.o.loop.width * run)
				controlX2 = cxTarget - (dv.o.loop.width * rise)
				controlY2 = cyTarget + (dv.o.loop.width * run)

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
		var q = d3.geom.quadtree(dv.data.pages)
			, i = 2
			, n = dv.data.pages.length
		;

		while (++i < n) q.visit(dv.util.collide(dv.data.pages[i]));

		// !Keep nodes inside viewport
		dv.svg.nodes
		    .attr('cx', function(d) { return d.x = Math.max(dv.scale.radius(d.views) + dv.o.page.pad.horizontal, Math.min(dv.dim.w - dv.scale.radius(d.views) - dv.o.page.pad.horizontal, d.x)); })
		    .attr('cy', function(d) { return d.y = Math.max(dv.scale.radius(d.views) + dv.o.page.pad.vertical, Math.min(dv.dim.h - dv.scale.radius(d.views) - dv.o.page.pad.vertical, d.y)); });
	  });

	
}

dv.draw.infobar = function() {
	dv.infobar.main = d3.select('body').append('div')
		.attr('id', 'infobar')
		.style(dv.o.infobar.position.side, 0)
		.style(dv.o.infobar.dim.max, '100%')
		.style(dv.o.infobar.dim.size, dv.o.infobar.size + 'px')
	;
	if (dv.o.infobar.position.side === 'top' || dv.o.infobar.position.side === 'bottom') {
		dv.dim.h -= dv.o.infobar.size;
	} else {
		dv.dim.w -= dv.o.infobar.size;
		dv.infobar.main.style('top', 0)
	}

	dv.infobar.title = dv.infobar.main.append('div')
		.attr('class', 'infobar-title')

	dv.infobar.siteStats = [];
	for (var i = 0; i < dv.o.infobar.stats.site; i++) {
		makeStats(dv.infobar.siteStats, i);
	}

	dv.infobar.pageStats = [];
	dv.infobar.pageTitle = dv.infobar.main.append('div')
		.attr('class', 'infobar-page-title')
	
	for (var i = 0; i < dv.o.infobar.stats.page; i++) {
		makeStats(dv.infobar.pageStats, i);
	}
	dv.infobar.title.text(dv.o.infobar.text);

	function makeStats(location, i) {
		location[i] = {};
		location[i].main = dv.infobar.main.append('div')
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

dv.draw.siteStats = function() {
	dv.infobar.siteStats[0].number.text(dv.format.comma(dv.data.total.views))
	dv.infobar.siteStats[0].descr.text('Total Pages Viewed')
	
	dv.infobar.siteStats[1].number.text(dv.format.round(dv.data.total.views / dv.data.total.sessions))
	dv.infobar.siteStats[1].descr.text('Average Pages / Session')

	dv.infobar.siteStats[2].number.text(dv.format.comma(dv.data.total.sessions))
	dv.infobar.siteStats[2].descr.text('Total Sessions')
}

dv.draw.pageStats = function(page) {
	
	dv.infobar.pageTitle.html('<span class="category">' + page.category + '</span> <span class="name">' + page.name + '</span>');

	dv.infobar.pageStats[0].number.html(dv.format.comma(page.views) + ' <span class="percent">(' + dv.format.percent(page.stats.percent.pages) + ')</span>');
	dv.infobar.pageStats[0].descr.text('Page Views');
	
	dv.infobar.pageStats[1].number.html(dv.format.comma(page.stats.sessions) + ' <span class="percent">(' + dv.format.percent(page.stats.percent.sessions) + ')</span>');
	dv.infobar.pageStats[1].descr.text('Sessions');
	
	dv.infobar.pageStats[2].number.html(dv.format.round(page.stats.session.pagesPer) + ' <span class="percent">(' + dv.format.percent(page.stats.session.percentOf) + ')</span>');
	dv.infobar.pageStats[2].descr.text('Pages / Session');
	
	dv.infobar.pageStats[3].number.html('<span class="comes-from">' + dv.format.percent(page.stats.from.percent) + '</span>')
	dv.infobar.pageStats[3].descr.html('Coming From <span class="category">' + page.stats.from.category + '</span> <span class="name">' + page.stats.from.name + '</span>');
	
	dv.infobar.pageStats[4].number.html('<span class="goes-to">' + dv.format.percent(page.stats.to.percent) + '</span>')
	dv.infobar.pageStats[4].descr.html('Going To <span class="category">' + page.stats.to.category + '</span> <span class="name">' + page.stats.to.name + '</span>');
	
/*
	dv.infobar.pageStats[3].number.html('<span class="name">' + page.stats.from. + '</span>')
	dv.infobar.pageStats[3].descr.html('<span class="comes-from">Coming From (' + dv.format.percent(page.stats.from.percent) + ')</span>');
	
	dv.infobar.pageStats[4].number.html('<span class="name">' + page.stats.to. + '</span>')
	dv.infobar.pageStats[4].descr.html('<span class="goes-to">Going To (' + dv.format.percent(page.stats.to.percent) + ')</span>');
	
*/

}

// Highlight links, fade nodes, etc…
dv.draw.nodeHighlight = function(node) {
	dv.state.selectedNodeID = node.pageID;
	node.state = 'selected';
	node.fixed = true;
	
	dv.draw.pageStats(node);

	// Highlight all links that touch
    var linkedNodes = {};
    linkedNodes[node.index] = true;
    dv.svg.links
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
					return dv.o.link.opac.highlight; 
				} else { 
					return dv.scale.linkOpacity(d.rides) * dv.o.link.opac.norm.min; 
				}
			});

	// Fade out any nodes not connected
	dv.svg.nodes
		.style('opacity', function(d) {
			if (!linkedNodes[d.index]) { 
				return dv.o.node.opac.hide; 
			}
		});
}


dv.clear.pageStats = function() {
	dv.infobar.pageTitle.text('');
	for (var i = 0; i < dv.o.infobar.stats.page; i++) {
		dv.infobar.pageStats[i].number.text('');
		dv.infobar.pageStats[i].descr.text('');
	}
	
}

// Return links and nodes to original state, hide tooltip
dv.clear.nodeHighlight = function(node) {
		dv.state.selectedNodeID = false;
    node.state = 'normal';
    dv.clear.pageStats();
    
    if (node.type !== 'special') { node.fixed = false; }
    dv.svg.links
			.style('stroke-opacity', function(d) { 
				d.state = 'normal';
				return dv.scale.linkOpacity(d.rides); 
			})
    	.attr('class', 'link');
    dv.svg.nodes
    	.style('opacity', 1);

}


// Collision function copied directly from Bostock examples http://bl.ocks.org/mbostock/3231298
dv.util.collide = function(node) {
	var r = dv.scale.radius(node.views) + 15
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
				, r = dv.scale.radius(node.views) + dv.scale.radius(quad.point.views)
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


// params = { loop:boolean, speed:milliseconds, delay:milliseconds }
dv.util.traceOne = function(params) {
		setTimeout(function(){
			setInterval(function() {
				params.pathIndex = params.pathIndex && params.pathIndex < dv.data.pathKeys.length ? params.pathIndex : 0;
				if ((params.autorun || dv.state.selectedNodeID) && !params.pause) { 
					if (dv.state.selectedNodeID) {
						params.sessIndex = params.sessIndex || 0;
						params.sessKeys = d3.keys(dv.map.nodeSession[dv.state.selectedNodeID]);
						if (params.sessIndex >= params.sessKeys.length) {
							params.sessIndex = 0;
							params.pause = true;
							setTimeout(function() { params.pause = false; }, 2 * params.delay)
							return false;	
						}
						params.sessID = params.sessKeys[params.sessIndex];
						params.sessIndex++;
					} else {
						params.sessID = dv.data.pathKeys[params.pathIndex]
						params.pathIndex++;
					}
					dv.util.traverseSession({
						session: dv.data.paths[params.sessID]
						, transitionCallback: dv.util.traverseSession
						, tracer: dv.o.tracer.create(params.sessID)
						, duration: params.speed
					});
				}
			}, params.repeat);
		}, params.delay);
}

// Go through each of the sessions in paths, one at a time, designed to be re-called after walking a session to move to the next path
// params = { pathMap, paths, pathIndex }
dv.util.traversePath = function(params) {
	if (!params.pathIndex) { params.pathIndex = 0; }
	if (params.pathIndex >= params.pathMap.length) { 
		if(params.loop) { 
		params.pathIndex = 0;
		} else { return false; }
	}
	params.session = params.paths[params.pathMap[params.pathIndex]];
	dv.util.traverseSession(params);
	params.pathIndex++;
}


// Go through each link in a session, one at a time, designed to be re-called after tracing a link to move to the next link
// params = { session, sessionIndex, sessionCallback }
dv.util.traverseSession = function(params) {
	if (!params.session) { console.log }
	if (dv.state.selectedNodeID && params.session.indexOf(dv.state.selectedNodeID) === -1 && params.sessionIndex < params.session.length - 2) {
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
		var linkName = dv.get.pairName(params.session[params.sessionIndex],params.session[params.sessionIndex+1])
			, linkIndex = dv.map.pairs[linkName]
		;
		params.link = dv.svg.links[0][linkIndex];
		dv.util.traceLink(params);
		params.sessionIndex++;
	}
}


// Traces the link using dv.util.translateAlong
// params = { link, tracer, transitionCallback }
dv.util.traceLink = function(params) {
	if (!params.duration) { params.duration = 1000; }
	params.tracer.transition()
		.duration(params.duration)
		.attrTween("transform", function() { return dv.util.translateAlong(params.link); })
		.each("end", function() { 
			if (params.transitionCallback) { params.transitionCallback(params); }
		});
}


// Returns an attrTween for translating along the specified path element.
dv.util.translateAlong = function(path) {
		return function(t) {
		 var l = path.getTotalLength(),
					p = path.getPointAtLength(t * l);
			return "translate(" + p.x + "," + p.y + ")";
		};
}


dv.setup.withoutData();
