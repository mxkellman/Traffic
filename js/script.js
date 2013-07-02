var w = window,
	d = document,
	e = d.documentElement,
	g = d.getElementsByTagName('body')[0],
	width = w.innerWidth || e.clientWidth || g.clientWidth,
	height = w.innerHeight || e.clientHeight || g.clientHeight,
	mindim = width < height ? width : height;
	svg = d3.select("body").select("svg")
	  .attr("width", width)
	  .attr("height", height),
	pairs = [],
	pairMap = [],
	network = [],
	paths = {},
	links = {},
	nodes = {},
	viewMax = 0,
	rideMax = 0;
	
// Settings
var rideMin = 0,
	radiusMin = 2,
	radiusMax = mindim / 20,
	linkDistMin = 2 * radiusMax,
	linkDistMax = 2 * radiusMax,
	linkStrMin = 0.1,
	linkStrMax = 0.5,
	linkWidthMin = 0.5,
	linkWidthMax = radiusMax,
	linkMinOpac = 0.2,
	linkMaxOpac = 0.5,
	linkLowlightOpac = 0.1,
	linkHighlightOpac = 0.7,
	nodeHiddenOpac = 0.25,
	gravity = 0.05,
	charge = -600,
	pageMap = ["Entry","Exit"],
	pages = [
		{name:"Entry", views:0, category:"Site", fixed:true, y:height/2, x:radiusMax},
		{name:"Exit", views:0, category:"Site",  fixed:true, y:height/2, x:width - radiusMax}
	],
	colors = ["#393b79", "#6b6ecf", "#637939", "#b5cf6b", "#8c6d31", "#e7ba52", "#843c39", "#d6616b", "#7b4173", "#ce6dbd"];

// Scales
var radiusScale = d3.scale.sqrt(),
	colorScale = d3.scale.ordinal(),
	linkDistScale = d3.scale.sqrt(),
	linkStrengthScale = d3.scale.sqrt(),
	linkWidthScale = d3.scale.sqrt(),
	linkOpacityScale = d3.scale.sqrt(),
    force = d3.layout.force();

var tooltip = d3.select("body").append("div")   
	.attr("class", "tooltip")               
	.style("opacity", 0);

d3.tsv("Path-1k-min.tsv", function(error, data) {
	data.forEach(function(d, i) {
		var params = d;
		// Add the Entry node to the page paths if it doesn't exist
		if (!paths[d.sessID]) { 
			params.pageName = "Entry"
			params.pageIndex = 0;
			addPageAndPath(params); 
		}
		params.pageName = d.Category + ' > ' + d.Page;
		params.pageIndex = pageMap.indexOf(params.pageName);
		addPageAndPath(params);
	});

	var pathKeys = d3.keys(paths);
	pathKeys.forEach(function(sessID) {
		var params = {};
		params.sessID = sessID;
		params.pageName = "Exit";
		params.pageIndex = 1;
		params.pageIndex = pageMap.indexOf(params.pageName);
		addPageAndPath(params);
	});
	
	function addPage(params) {
		if (params.pageIndex === -1 ) { 
			pageMap.push(params.pageName);
			params.pageIndex = pageMap.indexOf(params.pageName);
			pages.push({name:params.Page, views:0, category:params.Category});
		}			
		pages[params.pageIndex].views++;
	}
	
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

	function addPageAndPath(params) {
		addPage(params);
		addPath(params);
	}

	function addPair(params) {
		var pairName, pairIndex, loopString;
		if (params.pageNamePrev === params.pageName) {
			loopString = ' <> Loop';
			pairName = params.pageName + loopString;
			params.Page += loopString;
			params.pageName += loopString;
			params.pageIndex = pageMap.indexOf(params.pageName);
			addPage(params);
		} else {
			pairName = params.pageNamePrev + ' & ' + params.pageName;
		}
		pairIndex = pairMap.indexOf(pairName);
		if (pairIndex === -1) {
			pairMap.push(pairName);
			pairIndex = pairMap.indexOf(pairName);
			pairs.push({source:pageMap.indexOf(params.pageNamePrev), target:params.pageIndex, rides:0});
		}
		pairs[pairIndex].rides++;
	}

	viewMax = d3.max(pages, function(d) { return d.views; });
	rideMax = d3.max(pairs, function(d) { return d.rides; });

	radiusScale
		.domain([1,viewMax])
		.range([radiusMin,radiusMax]);

	colorScale.range(colors);
	
	linkDistScale
		.domain([1,rideMax])
		.range([linkDistMin, linkDistMax]);
	
	linkStrengthScale
		.domain([1,rideMax])
		.range([linkStrMin, linkStrMax]);

	linkWidthScale
        .domain([1, rideMax])
        .range([linkWidthMin, linkWidthMax]);

	linkOpacityScale
        .domain([1, rideMin, rideMax])
        .range([0, linkMinOpac,linkMaxOpac]);

    force
		.gravity(gravity)
		.charge(charge)
		.size([width, height])
		.nodes(pages)
		.links(pairs)
		.linkDistance(function(d) { return linkDistScale(d.rides) })
		.linkStrength(function(d, i) { return linkStrengthScale(d.rides) })
		.start();

    links = svg.selectAll(".link")
		.data(pairs)
		.enter().append("line")
		.attr("class", "link")
		.style("stroke-width", function(d) { return linkWidthScale(d.rides); })
		.style("stroke-opacity", function(d) { return linkOpacityScale(d.rides); })
	
	nodes = svg.selectAll(".node")
		.data(pages)
		.enter().append("circle")
			.attr("class", "node")
			.attr("r", function(d) { return radiusScale(d.views); } )
			.style("fill", function(d) { return colorScale(d.category); })
			.call(force.drag)
			.on("mouseover", function(d) { nodeHighlight(d); })
			.on("mouseout", function(d) { nodeReset(); });
	
	force.on("tick", function() {
		links.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });
	
		var q = d3.geom.quadtree(pages),
		    i = 2,
		    n = pages.length;
		
		while (++i < n) q.visit(collide(pages[i]));
		
		nodes
		    .attr("cx", function(d) { return d.x = Math.max(radiusScale(d.views), Math.min(width - radiusScale(d.views), d.x)); })
		    .attr("cy", function(d) { return d.y = Math.max(radiusScale(d.views), Math.min(height - radiusScale(d.views), d.y)); });
	  });
});

function nodeHighlight(node) {
    var linkedNodes = [node.index];
    links
		.attr("class", function(d) {
			if (d.source.index === node.index) { 
				if (linkedNodes.indexOf(d.target.index) === -1) { 
					linkedNodes.push(d.target.index); 
				} 
				return "link-source"; 
			}
			if (d.target.index === node.index) { 
				if (linkedNodes.indexOf(d.source.index) === -1) { 
					linkedNodes.push(d.source.index); 
				}
				return "link-target";
			}
			return "link";
		})
		.style("stroke-opacity", function(d) {
			if (d.source.index === node.index || d.target.index === node.index) { return linkHighlightOpac; } else { return linkOpacityScale(d.rides) * linkMinOpac; }
		});
	nodes
		.style("opacity", function(d) {
			if (linkedNodes.indexOf(d.index) === -1) { 
				return nodeHiddenOpac; 
			}
		});
	tooltip
		.transition()        
		.duration(200)      
		.style("opacity", .9)
		.text(node.category + ' > ' + node.name)
		.style("left", (d3.event.pageX) + "px")     
		.style("top", (d3.event.pageY - 28) + "px");    			
}

function nodeReset() {
    links
		.style("stroke-opacity", function(d) { return linkOpacityScale(d.rides); })
    	.attr("class", "link");
    nodes
    	.style("opacity", 1);

	tooltip
		.transition()        
		.duration(500)      
		.style("opacity", 0);   
}

function collide(node) {
	var r = radiusScale(node.views) + 15,
		nx1 = node.x - r,
		nx2 = node.x + r,
		ny1 = node.y - r,
		ny2 = node.y + r;

	return function(quad, x1, y1, x2, y2) {
		if (quad.point && (quad.point !== node)) {
			var x = node.x - quad.point.x,
			    y = node.y - quad.point.y,
			    l = Math.sqrt(x * x + y * y),
			    r = radiusScale(node.views) + radiusScale(quad.point.views);
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

