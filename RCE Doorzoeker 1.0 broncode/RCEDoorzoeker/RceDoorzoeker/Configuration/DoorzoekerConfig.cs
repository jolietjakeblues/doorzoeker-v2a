using System.Collections.Generic;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using RceDoorzoeker.Configuration.Thesauri;

namespace RceDoorzoeker.Configuration
{
	public class DoorzoekerConfig
	{
		public static DoorzoekerConfig Current { get; set; }

		public static DoorzoekerConfig Load(string filePathName)
		{
			DoorzoekerConfig config;
			using (var fileStream = new FileStream(filePathName, FileMode.Open, FileAccess.Read, FileShare.Read))
			using (var configReader = XmlReader.Create(fileStream))
			{
				var deserializer = new XmlSerializer(typeof(DoorzoekerConfig));
				config = (DoorzoekerConfig)deserializer.Deserialize(configReader);

				configReader.Close();
				fileStream.Close();
			}

			config.FilePathName = filePathName;

			return config;
		}
		
		public void Save(string filePathName)
		{
			var xmlWriterSettings = new XmlWriterSettings
			{
				Indent = true,
			};

			using (var fileStream = new FileStream(filePathName, FileMode.Create, FileAccess.Write, FileShare.None))
			using (var writer = XmlWriter.Create(fileStream, xmlWriterSettings))
			{
				var serializer = new XmlSerializer(typeof(DoorzoekerConfig));
				serializer.Serialize(writer, this);
			};
		}

		public void Save()
		{
			Save(FilePathName);
		}

		[XmlIgnore]
		public string FilePathName { get; set; }

		public List<ReferenceStructureEntry> ReferenceStructures { get; set; }
		public List<ItemTypeEntry> ItemTypes { get; set; }

		public List<FacetEntry> Facets { get; set; }

		public Node ThesauriRoot { get; set; }

		public RnaToolsetConfig RnaToolsetConfig { get; set; }
		public List<string> Languages { get; set; }
		public AdlibConfig Adlib { get; set; }
		public ItemClassificationConfig ItemClassifications { get; set; }
		public string MonumentNumberPredicateUri { get; set; }
		public List<PredicateEntry> MapInfoWindowPredicates { get; set; }
		public MapCoordinatePredicateConfig MapCoordinatePredicateUris { get; set; }
		public MapResultClusteringConfig MapResultClustering { get; set; }
		public GoogleAnalyticsConfig GoogleAnalytics { get; set; }
		public string GoogleMapsApiKey { get; set; }

		public DoorzoekerConfig()
		{
			Languages = new List<string>()
				{
					"dut",
					"nl",
					"nld"
				};

			RnaToolsetConfig = new RnaToolsetConfig()
			{
				BaseUrl = "http://[instance].rnatoolset.net",
				ApiKey = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
			};

			ReferenceStructures = new List<ReferenceStructureEntry>();
			ItemTypes = new List<ItemTypeEntry>();
			ThesauriRoot = new Node();
			Adlib = new AdlibConfig();
			MapInfoWindowPredicates = new List<PredicateEntry>();
			MapCoordinatePredicateUris = new MapCoordinatePredicateConfig();
			MapResultClustering = new MapResultClusteringConfig();
		}

		
	}
}