using System;
using System.Linq;
using RceDoorzoeker.Configuration;

namespace RceDoorzoeker.Services.Querying
{
	public class ItemFilter
	{
		private static readonly Lazy<string> s_filter = new Lazy<string>(DetermineFilter);

		public static string FqFilter
		{
			get { return s_filter.Value; }
		}

		private static string DetermineFilter()
		{
			var structures = DoorzoekerConfig.Current.ReferenceStructures
				.Where(s => s.Enabled)
				.Select(s => String.Format("root:\"{0}\"", s.Uri));

			var fqStructures = String.Join(" OR ", structures);

			var itemTypes =
				DoorzoekerConfig.Current.ItemTypes
					.Where(it => it.Enabled)
					.Select(it => String.Format("rnax_resource_itemType:\"{0}\"", it.Uri));

			var fqItemTypes = String.Join(" OR ", itemTypes);

			var fqFilter = String.Format("({0}) AND ({1})", fqStructures, fqItemTypes);
			return fqFilter;
		}
	}
}