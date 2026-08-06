using System.Collections.Generic;
using System.Linq;
using NLog;
using RceDoorzoeker.Models.GroupedResults;
using RceDoorzoeker.Models.Item;
using RceDoorzoeker.Services.Querying;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Services.Mappers
{
	public class GroupingsResultMapper
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();
		private readonly IBulkLoad _bulkLoader;

		public GroupingsResultMapper(IBulkLoad bulkLoader)
		{
			_bulkLoader = bulkLoader;
		}

		public IEnumerable<GroupingResultModel> MapGroupsResult(FacetResult result)
		{
			var groupModels = new List<GroupingResultModel>(result.FacetValues.Count());

			var groupRootUris = result
				.FacetValues
				.Select(g => g.Uri);

			var groupRootItems = BulkLoad(groupRootUris);
			
			foreach (var val in result.FacetValues)
			{
				var groupModel = new GroupingResultModel()
					{
						TotalItemCount = val.Count
					};
				
				var groupItem = groupRootItems[val.Uri].SingleOrDefault();
				if (groupItem == null)
				{
					s_logger.Warn("Group item missing, can't label it. Uri: " + val.Uri);
					groupModel.GroupLabel = new ResourceValueModel(val.Uri, true);
				}
				else
				{
					groupModel.GroupLabel = new ResourceValueModel(DoorzoekerModelMapper.DeterminePreferredLabel(groupItem.PrefLabel).Value, link: val.Uri)
							{
								Classification = DoorzoekerModelMapper.DetermineClassification(groupItem)
							}; 
				}

				groupModels.Add(groupModel);
			}
			return groupModels;
		}

		private ILookup<string, Item> BulkLoad(IEnumerable<string> itemUris)
		{
			return _bulkLoader
				.Load(itemUris)
				.ToLookup(ri => ri.Uri);
		}
	}
}