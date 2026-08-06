using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services.MapItemClustering;

namespace RceDoorzoeker.Services.Querying
{
	static internal class MapSearchResultParser
	{
		public static ClusteredItems ConsumeMapResult(Stream stream, double latLongPerPixel)
		{
			var parser = new XmlReaderItemResultParser(stream);

			var numFound = parser.ResultCount;

			if (numFound >= 2500)
			{
				// too many items... return nothing, only the count
				return new ClusteredItems()
					{
						TooManyResults = true,
						TotalCount = numFound,
					};
			}

			var items = parser.ParseItems();
			if (items == null)
			{
				return null;
			}

			ClusteredItems result;
			
			if (DoorzoekerConfig.Current.MapResultClustering.Enabled)
			{
				var clusterer = new MapItemClusterer();
				var sw = new Stopwatch();
				sw.Start();

				result = clusterer.CreateClustering(items.Items, latLongPerPixel);
				sw.Stop();
				Debug.WriteLine("Clustering #{1} items: {0:0.000}", sw.ElapsedMilliseconds / 1000.0, items.Items.Count);
			}
			else
			{
				result = new ClusteredItems()
					{
						Points = (List<SearchResultItem>) items.Items,
						TotalCount = numFound
					};
			}

			return result;
		}
	}
}