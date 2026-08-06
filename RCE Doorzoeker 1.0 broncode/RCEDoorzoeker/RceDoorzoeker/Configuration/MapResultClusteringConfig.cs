using System.Xml.Serialization;

namespace RceDoorzoeker.Configuration
{
	public class MapResultClusteringConfig
	{
		public MapResultClusteringConfig()
		{
			Enabled = true;
		}
		
		[XmlAttribute]
		public bool Enabled { get; set; }
	}
}