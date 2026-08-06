using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Web.Http;

using RceDoorzoeker.Configuration;
using RceDoorzoeker.Configuration.Thesauri;
using RceDoorzoeker.Models.Thesaurus;
using RceDoorzoeker.Services.Mappers;
using RceDoorzoeker.Services.RnaApiClient;
using Trezorix.RnaRemote.Core.ReferenceStructures;
using Trezorix.RnaRemote.RepositoryBase;
using WebAPI.OutputCache;

namespace RceDoorzoeker.Controllers
{
	public class ThesaurusController : ApiController
	{
		private readonly IReferenceStructureRepository _referenceStructureRepository;
		private readonly IItemStore _itemStore;
		private readonly LocalWebApiV2Client _apiV2Client;

		public ThesaurusController(IReferenceStructureRepository referenceStructureRepository, IItemStore itemStore, LocalWebApiV2Client apiV2Client)
		{
			_referenceStructureRepository = referenceStructureRepository;
			_itemStore = itemStore;
			_apiV2Client = apiV2Client;
		}

		[HttpGet]
		[CacheOutput(ClientTimeSpan = 3600, ServerTimeSpan = 3600, MustRevalidate = true)]
		public ThesauriNodeModel ThesauriRoot()
		{
			var root = DoorzoekerConfig.Current.ThesauriRoot;

			var modelRoot = MapNode(root);

			return modelRoot;
		}

		private ThesauriNodeModel MapNode(Node node)
		{
			var thesauri = node
				.Thesauri
				.Where(t => t.Enabled)
				.Select(MapThesaurus)
				// remove unmappable entries
				.Where(tm => tm != null)
				.ToList();

			return new ThesauriNodeModel()
				{
					Name = node.Name,
					Nodes = node.Nodes.Select(MapNode).ToList(),
					Thesauri = thesauri
				};
		}

		private ThesaurusModel MapThesaurus(Thesaurus thesaurus)
		{
			var referenceStructure = _referenceStructureRepository.Get(thesaurus.Uri);

			if (referenceStructure == null)
			{
				return null;
			}

			return new ThesaurusModel() 
				{ 
					Uri = thesaurus.Uri, 
					Name = DoorzoekerModelMapper.DeterminePreferredLabel(referenceStructure.PrefLabel).Value
				};
		}

		[HttpGet]
		public ItemPathModel ItemPath(string uri)
		{
			var item = _itemStore.Get(uri);

			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var itemPath = new ItemPathModel
				{
					Uri = uri,
					Structure = item.ReferenceStructure.Uri
				};

			// add self
			itemPath.Nodes.Add(new ItemPathNode() { Uri = item.Uri });
			
			while (item.Parent != null)
			{
				itemPath.Nodes.Add(new ItemPathNode()
					{
						Uri = item.Parent.Uri
					});

				item = item.Parent;
			}

			Parallel.ForEach(itemPath.Nodes, n => n.Row = _apiV2Client.GetChildRowPosition(n.Uri));

			// reverse the list so the elderly get mentioned first
			itemPath.Nodes = itemPath.Nodes.Reverse().ToList();

			return itemPath;
		}

	}
}
