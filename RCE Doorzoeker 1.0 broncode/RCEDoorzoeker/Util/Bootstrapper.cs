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

namespace RceDoorzoeker.Util
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

			container.Register<RnaSession>(() => container.GetInstance<RnaContext>().StartSession());

			container.Register<IItemStore>(() => (IItemStore)container.GetInstance<RnaSession>().ItemRepository);

			container.Register<IItemRepository>(() => container.GetInstance<RnaSession>().ItemRepository);

			container.Register<IPredicateRepository>(() => container.GetInstance<RnaSession>().PredicateRepository);
			container.Register<IReferenceStructureRepository>(() => container.GetInstance<RnaSession>().ReferenceStructureRepository);

			container.Register<IBulkLoad>(() => (IBulkLoad)container.GetInstance<RnaSession>().ItemRepository);

			container.Register<AdlibImageQueryer>(() => new AdlibImageQueryer(DoorzoekerConfig.Current.Adlib.ApiBaseUrl));

			container.Register<IItemTypeRepository>(() => container.GetInstance<RnaSession>().ItemTypeRepository);

			container.RegisterSingle<FacetRegistry>(() =>
			{
				var session = container.GetInstance<RnaSession>();
				return new FacetRegistry((IItemStore)session.ItemRepository);
			});
		}

	}
}