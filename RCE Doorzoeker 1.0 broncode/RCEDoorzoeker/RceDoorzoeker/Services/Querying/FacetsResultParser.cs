using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.XPath;
using NLog;

namespace RceDoorzoeker.Services.Querying
{
	public class FacetsResultParser
	{
		private readonly FacetRegistry _facetRegistry;
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		public FacetsResultParser(FacetRegistry facetRegistry)
		{
			_facetRegistry = facetRegistry;
		}

		public IReadOnlyCollection<FacetResult> Parse(XPathDocument xml)
		{
			var nav = xml.CreateNavigator();

			var facets = nav.Select("//lst[@name='facet_fields']/lst[count(int) > 0]");

			var result = new List<FacetResult>(facets.Count);

			foreach (XPathNavigator facetElement in facets)
			{
				var facetName = facetElement.GetAttribute("name", "");

				var facet = _facetRegistry.Facets.SingleOrDefault(f => f.FieldName == facetName);
				if (facet == null)
				{
					s_logger.Warn("Can't find facet for facet field name " + facetName);
					continue;
				}

				var facetValueElements = facetElement.Select("int");

				var facetValues = facetValueElements.OfType<XPathNavigator>()
					.Select(fv => new FacetValue()
						{
							Uri = fv.GetAttribute("name", ""),
							Count = fv.ValueAsInt,
						})
						.ToList();
				
				var facetResult = new FacetResult()
					{
						Facet = facet,
						FacetValues = facetValues
					};
				
				result.Add(facetResult);
			}

			return result;
		}
	}
}