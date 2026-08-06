using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Models.Item
{
	public enum ItemClassification
	{
		None = 0,
		ThesaurusTerm = 1,
		BronRecord = 2,	
	}

	public class ResourceValueModel
	{
		public string Label { get; set; }
		
		public string Link { get; set; }
		public bool IsInRecycleBin { get; set; }

		public bool IsUnresolved { get; set; }

		public LatLong Coordinate { get; set; }

		public ItemClassification Classification { get; set; }
		
		public ResourceValueModel(string label)
		{
			Label = label;
		}
		
		public ResourceValueModel(string label, bool isUnresolved) : this(label)
		{
			IsUnresolved = isUnresolved;
		}

		public ResourceValueModel(string label, string link, bool isInRecycleBin = false) : this(label)
		{
			Link = link;
			IsInRecycleBin = isInRecycleBin;
		}

		public ResourceValueModel()
		{
			
		}
	}
}