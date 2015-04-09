SourcesDB = new Meteor.Collection("sources");
ProjectsDB = new Meteor.Collection("projects");
DatasetsDB = new Meteor.Collection("datasets");
OutputsDB = new Meteor.Collection(null);


if (Meteor.isClient) {

  Meteor.startup(function () {

    Meteor.call("rebuild")
    clearInfoFields()

  });

  Handlebars.registerHelper("splitSlash", function(x) {
    return x.replace(".", " / ")
  });

  Handlebars.registerHelper("splitSpace", function(x) {
    return x.replace(".", " ")
  });

  Handlebars.registerHelper("commaList", function(x) {
    return x.join(", ")
  });

  // column for sources
  Template.sourcesColumn.helpers({

    sources: function() {
      return SourcesDB.find({}, {
        sort: {
          type: 1,
          name: 1
        }
      });
    },

    selected: function() {
      return Session.equals("source", this.name) ? "active" : ""
    }

  })

  Template.sourcesColumn.events({
    'click': function() {
      Session.set("source", this.name)
      Session.set("project", "")
      Session.set("dataset", "")
      clearInfoFields()
    }
  })


  // column for projects
  Template.projectsColumn.helpers({

    projects : function() {
      return ProjectsDB.find({source: Session.get("source")}, {
        sort: {
          name: 1
        }
      });
    },

    selected: function() {
      return Session.equals("project", this.name) ? "active" : '';
    }

  })

  Template.projectsColumn.events({
    'click': function() {
      Session.set("project", this.name)
      Session.set("dataset", "")
      clearInfoFields()
    }
  })


  // column for datasets
  Template.datasetsColumn.helpers({
    
    datasets : function() {
      return DatasetsDB.find({
        source: Session.get("source"), 
        project: Session.get("project")}, {
        sort: {
          name: 1
        }
      });
    },

    selected: function() {
      return Session.equals("dataset", this.name) ? "active" : '';
    }
  })
  
  Template.datasetsColumn.events({
    'click': function() {
      if (_.isEmpty(this)) {
        clearInfoFields()
      } else {
        Session.set("dataset", this.name)
        Session.set("contributors", this.contributors)
        Session.set("location", this.location)
        Session.set("animal", this.animal)
        Session.set("experiment", this.experiment)
        Session.set("method", this.method)
        Session.set("dimensions", this.dimensions)
        Session.set("contents", this.contents)
        Session.set("download", "ready")
      }
    }
  })

  // info for the selected dataset
  Template.datasetInfo.helpers({

    source : function() { return Session.get("source")},
    project : function() { return Session.get("project")},
    contributors : function() { return Session.get("contributors")},
    location : function() { return Session.get("location")},
    animal : function() { return Session.get("animal")},
    experiment : function() { return Session.get("experiment")},
    method : function() { return Session.get("method")},
    dimensions : function() { return Session.get("dimensions")},
    contents : function() { return Session.get("contents")},
    dataset : function() { return Session.get("dataset")}
      
  })

  // list of output method
  Template.outputMethods.helpers({

    methods : function() {
      return ["Thunder", "Download", "DBCloud"]
    },

    selected: function() {
      return Session.equals("outputMethod", this.slice(0,this.length)) ? "active" : '';
    }

  })

  Template.outputMethods.events({
    'click': function() {
      Session.set("outputMethod", this.slice(0,this.length))
    }
  })

  // specify output
  Template.getData.helpers({

    source : function() {
      return Session.get("source")
    },

    project : function() {
      return Session.get("project")
    },

    dataset : function() {
      return Session.get("dataset")
    },

    outputMethod : function() {
      return Session.get("outputMethod")
    },

    download : function() {
      return Session.get("download")
    }

  })

  // refresh the database and selections
  Template.refresh.events({
    'click': function() {
      Session.set("source", "")
      Session.set("project", "")
      clearInfoFields()
      Meteor.call("rebuild")
    }
  })

  // download from S3
  Template.downloadFromS3.events({
    'click': function() {
      downloadFromS3("/Users/freemanj11/test/")
    }
  })

}

if (Meteor.isServer) {

  Meteor.methods({

    rebuild : function() {

      DatasetsDB.remove({});
      SourcesDB.remove({});
      ProjectsDB.remove({});

      var data = []

      baseurl = "http://s3.amazonaws.com/neuro.datasets/"

      // list top-level directories
      var url = baseurl + "?delimiter=/"
      var sources = getDirsFromS3(url)

      _.each(sources, function(s) {

        // list second-level directories
        var url = baseurl + "?delimiter=/&prefix=" + s + "/"
        var projects = getDirsFromS3(url)

        if (String(s).indexOf("lab") > -1) {
          type = "lab"
        } else {
          type = "other"
        }

        SourcesDB.insert({name: s, type: type})

        _.each(projects, function(p) {

          // list lowest-level directories
          var url = baseurl + "?delimiter=/&prefix=" + s + "/" + p + "/"
          var datasets = getDirsFromS3(url)

          // load the info.json and add info here
          ProjectsDB.insert({
            source: s, 
            name: p})

          _.each(datasets, function(d) {

            var file = baseurl + s + "/" + p + "/" + d + "/info.json"
            var request = HTTP.get(file)
            var json = JSON.parse(request.content)

            var url = baseurl + "?delimiter=/&prefix=" + s + "/" + p + "/" + d + "/"
            var dirs = getDirsFromS3(url)

            var item = {
              source: s, 
              project: p,
              name: d, 
              contributors: json.contributors,
              location: json.location,
              animal: json.animal,
              preparation: json.preparation,
              experiment: json.experiment,
              dimensions: json.dimensions,
              contents: dirs,
              method: json.method
            }
            data.push(item)
            DatasetsDB.insert(item)
          
          })

        })
        
      })

    }

  })

  Meteor.startup(function () {

    Meteor.call("rebuild")

  });

}

function clearInfoFields() {
  Session.set("dataset", "")
  Session.set("contributors", "")
  Session.set("location", "")
  Session.set("animal", "")
  Session.set("experiment", "")
  Session.set("method", "")
  Session.set("dimensions", "")
  Session.set("contents", "")
  Session.set("download", "")
}

function downloadFromS3(localDir) {

  console.log("Not yet implemented")

}


// get top-level directories from a S3 bucket URL
function getDirsFromS3(url) {

  var parse = Meteor.npmRequire('xml-parser');

  var result = HTTP.get(url)
  var xml = parse(result.content)
  var directories = _.filter(xml.root.children, function(d) {return d.name == "CommonPrefixes"})
  var output = _.map(directories, function(d) {
    return d.children[0].content.slice(0, -1).split("/").pop()})
  return output
  
}