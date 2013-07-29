// !Constants and placeholders
var w = window
	, d = document
	, e = d.documentElement
	, g = d.getElementsByTagName('body')[0]
	, width = w.innerWidth || e.clientWidth || g.clientWidth
	, height = w.innerHeight || e.clientHeight || g.clientHeight
	, mindim = width < height ? width : height;
	svg = d3.select('body').select('svg')
	  .attr('width', width)
	  .attr('height', height)
	, pages = [{name:'Entry', views:0, category:'Site', type:'special', fixed:true, y:height/2}
	, 		{name:'Exit', views:0, category:'Site',  type:'special', fixed:true, y:height/2}]
	, pageMap = {'Entry':0,'Exit':1}
	, nodes = []
	, paths = {}
	, pairs = []
	, pairMap = {}
	, links = []
	, viewMax = 0
	, rideMax = 0
	, loopMax = 0
	, scale = {}
	, force = {}
;

	
// !Settings
var rideMin = 0
	, radiusMin = 2
	, radiusMax = mindim / 20
	, strokeMin = 0.5
	, strokeMax = 2
	, linkStrMin = 0.1
	, linkStrMax = 0.5
	, linkWidthMin = 0.5
	, linkWidthMax = radiusMax
	, linkMinOpac = 0.2
	, linkMaxOpac = 0.3
	, linkLowlightOpac = 0.1
	, linkHighlightOpac = 0.9
	, loopStrMin = 1
	, loopStrMax = 0.25
	, loopWidth = 0.75
	, nodeHiddenOpac = 0.25
	, gravity = .1
	, charge = -800
	, colors = ['#393b79', '#6b6ecf', '#637939', '#b5cf6b', '#8c6d31', '#e7ba52', '#843c39', '#d6616b', '#7b4173', '#ce6dbd']
;
pages[0].x = radiusMax + strokeMax;
pages[1].x = width - radiusMax - strokeMax;

// !Create tooltip
var tooltip = d3.select('body').append('div')   
	.attr('class', 'tooltip')               
	.style('opacity', 0);

d3.tsv('Path-1k-min.tsv', function(error, data) {
	// !Collect and count pages (for nodes), collect paths, collect and counts pairs (for links)
	data.forEach(function(d, i) {
		var params = d;
		// Add the Entry node to the page paths if it doesn't exist
		if (!paths[d.sessID]) { 
			params.pageName = 'Entry'
			params.pageIndex = 0;
			addPageAndPath(params);
		}
		params.pageName = d.Category + ' > ' + d.Page;
		params.pageIndex = pageMap[params.pageName] || -1;
		params.type = 'page';
		addPageAndPath(params);
	});

	// !Add the Exit node to all page paths
	var pathKeys = d3.keys(paths);
	pathKeys.forEach(function(sessID) {
		var params = {};
		params.sessID = sessID;
		params.pageName = 'Exit';
		params.pageIndex = 1;
		addPageAndPath(params);
	});

	// Add pages and paths (convenience function)
	function addPageAndPath(params) {
		addPage(params);
		addPath(params);
	}

	// Add the page if needed, increment views for the page
	function addPage(params) {
		if (params.pageIndex === -1 ) { 
			params.pageIndex = pages.push({name:params.Page, category:params.Category, type:params.type, views:0 }) - 1;
			pageMap[params.pageName] = params.pageIndex;
		}			
		pages[params.pageIndex].views++;
	}
	
	// Add page to path, call the pairs function
	function addPath(params) {
		var path, length, i = 0;
		if (!paths[params.sessID]) { paths[params.sessID] = []; }
		path = paths[params.sessID];
		path.push(params.pageName);
		var length = path.length;
		if (length > 1) {
			params.pageNamePrev = path[length-2];
			addPair(params);
		}
	}

	// Add pair if needed, increment the 'rides' for the pair
	function addPair(params) {
		var pairName, pairIndex, loopString, sourceIndex;
		// Treat looped pages differently
		if (params.pageNamePrev === params.pageName) {
			loopString = ' <> Loop';
			pairName = params.pageName + loopString;
			params.Page += loopString;
			params.pageName += loopString;
			params.pageIndex = pageMap[params.pageName] || -1;
			params.type = 'loop';
			addPage(params);
		} else {
			params.type = 'pair';
			pairName = params.pageNamePrev + ' & ' + params.pageName;
		}
		pairIndex = pairMap[pairName] || -1;
		if (pairIndex === -1) {
			sourceIndex = pageMap[params.pageNamePrev];
			pairIndex = pairs.push({source:sourceIndex, target:params.pageIndex, type:params.type, rides:0}) - 1;
			pairMap[pairName] = pairIndex;
		}
		pairs[pairIndex].rides++;
	}

	// !Calculate maximum page views (nodes) and 'rides' (links)
	viewMax = d3.max(pages, function(d) { return d.views; });
	rideMax = d3.max(pairs, function(d) { return d.rides; });
	loopMax = d3.max(pairs, function(d) { if (d.type === 'loop') return d.rides; });

	// !Scales
	scale.radius = d3.scale.sqrt()
		.domain([1,viewMax])
		.range([radiusMin, radiusMax]);

	scale.color = d3.scale.ordinal()
		.range(colors);
	
	scale.strokeWidth = d3.scale.sqrt()
		.domain([1,viewMax])
		.range([strokeMin, strokeMax])
	
	scale.linkStr = d3.scale.sqrt()
		.domain([1,rideMax])
		.range([linkStrMin, linkStrMax]);

	scale.linkWidth = d3.scale.sqrt()
        .domain([1, rideMax])
        .range([linkWidthMin, linkWidthMax]);

	scale.linkOpacity = d3.scale.sqrt()
        .domain([1, rideMin, rideMax])
        .range([0, linkMinOpac,linkMaxOpac]);

	scale.loopStr = d3.scale.sqrt()
		.domain([1,loopMax])
		.range([loopStrMin, loopStrMax]);


	// !Create force layout, nodes (pages), links (pairs)
	force = d3.layout.force()
		.gravity(gravity)
		.charge(function(d) { if (d.state === 'selected') {return -5000;} else {return charge}})
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
		.start();

	links = svg.selectAll('.link')
		.data(pairs)
		.enter()
		.append('path')
			.attr('class', 'link')
			.style('stroke-width', function(d) { return scale.linkWidth(d.rides); })
			.style('stroke-opacity', function(d) { return scale.linkOpacity(d.rides); })
	
	// Draw nodes after links to put them on top
	nodes = svg.selectAll('.node')
		.data(pages)
		.enter().append('circle')
			.attr('class', function(d) { if (d.type !== 'loop') { return 'node' } else { return 'node-loop'; } })
			.attr('r', function(d) { return scale.radius(d.views); } )
			.style('stroke', function(d) { return scale.color(d.category); })
			.style('stroke-width', function(d) { return scale.strokeWidth(d.views); } )
			.call(force.drag)
			.on('mouseover', function(d) { nodeHighlight(d); })
			.on('mouseout', function(d) { nodeReset(d); });
	
	// !Update links and nodes on force 'tick'
	force.on('tick', function() {
	  links.attr('d', function(d) {
			if (d.type === 'loop') {
				var rise = d.source.y - d.target.y
					, run = d.source.x - d.target.x
					, cxTarget = d.target.x - (run / 3)
					, cyTarget = d.target.y -  (rise / 3)
					, controlX1 = cxTarget + (loopWidth * rise)
					, controlY1 = cyTarget - (loopWidth * run)
					, controlX2 = cxTarget - (loopWidth * rise)
					, controlY2 = cyTarget + (loopWidth * run)
				;
			
				return 'M' + d.source.x + ',' + d.source.y
					+ ' C' + controlX1 + ',' + controlY1
					+ ' ' + controlX2 + ',' + controlY2
					+ ' ' + d.source.x + ',' + d.source.y
			} else {
				return 'M' + d.source.x + ',' + d.source.y
						+ ' L' + d.target.x + ',' + d.target.y
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
		    .attr('cx', function(d) { return d.x = Math.max(scale.radius(d.views), Math.min(width - scale.radius(d.views), d.x)); })
		    .attr('cy', function(d) { return d.y = Math.max(scale.radius(d.views), Math.min(height - scale.radius(d.views), d.y)); });
	  });
});

// Highlight links, fade nodes, show tooltip
function nodeHighlight(node) {
	node.state = 'selected';
	node.fixed = true;
	force.start();

	// Highlight all links that touch
    var linkedNodes = [node.index];
    links
			.attr('class', function(d) {
				if (d.source.index === node.index) { 
					linkedNodes.push(d.target.index);
					return 'link-source'; 
				}
				if (d.target.index === node.index) { 
					linkedNodes.push(d.source.index);
					return 'link-target';
				}
				return 'link';
			})
			.attr('d', function(d) {
				if ((d.source.index === node.index || d.target.index === node.index) && d.type !== 'loop') {
					var rise = d.source.y - d.target.y
						, run = d.source.x - d.target.x
						, controlX, controlY
					;
					if (d.source.index === node.index) {
						controlX = d.target.x + (run / 2) + (rise / 2);
						controlY = d.target.y + (rise / 2) - (run / 2);
					} else {
						controlX = d.target.x + (run / 2) + (rise / 2);
						controlY = d.target.y + (rise / 2) - (run / 2);
					}
					return 'M' + d.source.x + ',' + d.source.y
						+ ' S' + controlX + ',' + controlY
						+ ' ' + d.target.x + ',' + d.target.y
				}
				return 'M' + d.source.x + ',' + d.source.y
						+ ' L' + d.target.x + ',' + d.target.y
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
			if (linkedNodes.indexOf(d.index) === -1) { 
				return nodeHiddenOpac; 
			}
		});

	// Show tooltip
/*
	tooltip
		.transition()        
		.duration(200)      
		.style('opacity', .9)
		.text(node.category + ' > ' + node.name)
		.style('left', (d3.event.pageX) + 'px')     
		.style('top', (d3.event.pageY - 28) + 'px');    			
*/
}


function linkPath(d, type) {
	if (type === 'loop') {
		
	} else if (type === '') {
	
	}
}

// Return links and nodes to original state, hide tooltip
function nodeReset(node) {
    node.state = 'normal';
    if (node.index > 1) { node.fixed = false; }
    force.start();
    links
		.style('stroke-opacity', function(d) { return scale.linkOpacity(d.rides); })
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
	, 	nx1 = node.x - r
	, 	nx2 = node.x + r
	, 	ny1 = node.y - r
	, 	ny2 = node.y + r;

	return function(quad, x1, y1, x2, y2) {
		if (quad.point && (quad.point !== node)) {
			var x = node.x - quad.point.x
	, 		    y = node.y - quad.point.y
	, 		    l = Math.sqrt(x * x + y * y)
	, 		    r = scale.radius(node.views) + scale.radius(quad.point.views);
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

