using RceDoorzoeker.Configuration;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.AdlibQuerying;
using SimpleInjector;
using Trezorix.RnaRemote;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.Core.ItemTypes;
using Trezorix.RnaRemote.Core.Predicates;
using Trezorix.RnaRemote.Core.ReferenceStructures;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker
{
	public class Bootstrapper
	{
		public static void RegisterServices(Container container)
		{
			container.RegisterSingle<RnaApiConnector>(() =>
			{
				var cfg = DoorzoekerConfig.Current.RnaToolsetConfig;
				return new RnaApiConnector(cfg.BaseUrl, cfg.ApiKey);
			});

			container.RegisterSingle<RnaContext>(() => RnaContext.OpenCoreModelOnly(container.GetInstance<RnaApiConnector>()));

			container.Register<RnaBasicSession>(() => container.GetInstance<RnaContext>().StartBasicSession());

			container.Register<IItemStore>(() => (IItemStore)container.GetInstance<RnaBasicSession>().ItemRepository);

			container.Register<IItemRepository>(() => container.GetInstance<RnaBasicSession>().ItemRepository);

			container.Register<IPredicateRepository>(() => container.GetInstance<RnaBasicSession>().PredicateRepository);
			container.Register<IReferenceStructureRepository>(() => container.GetInstance<RnaBasicSession>().ReferenceStructureRepository);

			container.Register<IBulkLoad>(() => (IBulkLoad) container.GetInstance<RnaBasicSession>().ItemRepository);

			container.Register<AdlibImageQueryer>(() => new AdlibImageQueryer(DoorzoekerConfig.Current.Adlib.ApiBaseUrl));
			container.Register<AdlibLiteratureQueryer>(() => new AdlibLiteratureQueryer(DoorzoekerConfig.Current.Adlib.ApiBaseUrl));

			container.Register<IItemTypeRepository>(() => container.GetInstance<RnaBasicSession>().ItemTypeRepository);
			
			container.RegisterSingle<FacetRegistry>(() =>
					{
						var session = container.GetInstance<RnaBasicSession>();
						return new FacetRegistry((IItemStore) session.ItemRepository);
					}); 
		}
	}
}