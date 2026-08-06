namespace RceDoorzoeker.Models.Item
{
	public abstract class ItemModel
	{
		public string Uri { get; set; }

		public ResourceValueModel ReferenceStructure { get; set; }
 
		public SkosPropertyListModel PrefLabels { get; set; }
		public SkosPropertyListModel AltLabels { get; set; }
		public SkosPropertyListModel HiddenLabels { get; set; }
		public SkosPropertyListModel Definitions { get; set; }

		public StringListModel Source { get; set; }
		public StringListModel SourceId { get; set; }
		public StringListModel Note { get; set; }
		public StringListModel Specification { get; set; }

		public string ItemPrefLabel { get; set; }
		
		public bool IsInRecycleBin { get; set; }

		public int Version { get; set; }
		
		public ItemClassification Classification { get; set; }
	}
}