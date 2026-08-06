using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Configuration.Thesauri;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.Mappers;
using RceDoorzoeker.Tests.System;
using Trezorix.RnaRemote;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.Querying.Items.QueryCriteria;

namespace RceDoorzoeker.Util
{
	public class Program
	{
		private static RnaSession s_session;
		private static SimpleInjector.Container s_container;
		private static InstanceRegistry s_instanceRegistry;

		static void Main(string[] args)
		{
			s_instanceRegistry = InstanceRegistry.Load(Path.Combine(Environment.CurrentDirectory, "..\\..\\InstanceRegistry.cfg"));

			if (args[1].Equals("config"))
			{
				if (args[2].Equals("import"))
				{
					LoadConfig(args[0]);

					InitInstance();
					ConfigImport();
				}
				else if (args[2].Equals("create"))
				{
					if (args.Length < 4)
					{
						Error("Missing sitename parameter.");
					}
					else
					{
						CreateConfig(args[0], args[3]);
					}

				}
			}
			else if (args[1].Equals("thesauri"))
			{
				if (args[2].Equals("sampletree"))
				{
					LoadConfig(args[0]);
					InitInstance();

					CreateThesauriTree();
				}
			}
			else if (args[0].Equals("profile"))
			{
				if (args[1].Equals("mapquery"))
				{
					RunMapQueryTest();
				}
			}

			Console.WriteLine("Press a key to exit.");
			Console.ReadKey();

		}

		private static void RunMapQueryTest()
		{
			var test = new QueryGroupingItemsMapPerformanceTests();

			test.Setup();

			test.Test();
		}

		private static void CreateThesauriTree()
		{
			var list = new List<Thesaurus>();
			
			var repository = s_session.ReferenceStructureRepository;
			var all = repository.All();

			foreach (var rs in all)
			{
				list.Add(new Thesaurus() { Name = DoorzoekerModelMapper.DeterminePreferredLabel(rs.Value.PrefLabel).Value, Uri = rs.Uri, Enabled = true });
			}
			
			var cfg = DoorzoekerConfig.Current;
			cfg.ThesauriRoot.Name = "root";
			cfg.ThesauriRoot.Nodes = new List<Node>
				{
					new Node()
						{
							Name = "Erfgoed thesauri",
							Thesauri = list
						}
				};

			cfg.Save();
		}

		private static void Error(string msg)
		{
			Console.WriteLine(msg);
			
		}

		private static void ConfigImport()
		{
			ImportReferenceStructures();

			ImportItemTypes();

			ImportFacets();

			Console.WriteLine("Saving config.");
			DoorzoekerConfig.Current.Save();
		}

		private static void ImportFacets()
		{
			var facetEntries = DoorzoekerConfig.Current.Facets;

			if (facetEntries.All(f => f.FacetType != FacetType.Structure))
			{
				facetEntries.Add(new FacetEntry()
				{
					Enabled = true,
					FacetType = FacetType.Structure,
					Name = "structure"
				});
			}

			if (facetEntries.All(f => f.FacetType != FacetType.ItemType))
			{
				facetEntries.Add(new FacetEntry()
					{
						Enabled= true, 
						FacetType = FacetType.ItemType, 
						Name = "item type"
					});	
			}
			
			var cfgFacets = facetEntries.ToLookup(rs => rs.PredicateUri);

			var repository = s_session.PredicateRepository;

			var all = repository.All().ToList();

			// remove predicate based facets that no longer exist.
			foreach (var facet in facetEntries.Where(f => f.FacetType == FacetType.Predicate).ToList())
			{
				if (all.SingleOrDefault(rs => rs.Uri == facet.PredicateUri) == null)
				{
					Console.WriteLine("Removing facet {0}", facet.Name);
					facetEntries.Remove(facet);
				}
			}

			// Add missing facets
			var missingPredicatefacets = all.Where(rs => !cfgFacets.Contains(rs.Uri)).Where(f => f.Value != null);
			foreach (var facet in missingPredicatefacets)
			{
				var name = GetName(facet.Value.PrefLabel);

				Console.WriteLine("Adding facet {0}", name);

				facetEntries.Add(new FacetEntry()
					{
						FacetType = FacetType.Predicate,
						PredicateUri = facet.Uri,
						Name = name,
						Enabled = facet.Value.Facet
					});
			}
		
		}

		private static void ImportItemTypes()
		{
			var rsEntries = DoorzoekerConfig.Current.ItemTypes;
			var cfgItemTypes = rsEntries.ToLookup(rs => rs.Uri);

			var repository = s_session.ItemTypeRepository;

			var all = repository.All().ToList();

			// remove itemTypes that no longer exist
			foreach (var itemType in rsEntries.ToList())
			{
				if (all.SingleOrDefault(rs => rs.Uri == itemType.Uri) == null)
				{
					Console.WriteLine("Removing item type {0}", itemType.Name);
					rsEntries.Remove(itemType);
				}
			}

			// Add missing itemTypes
			var missingItemTypes = all.Where(rs => !cfgItemTypes.Contains(rs.Uri));
			foreach (var itemType in missingItemTypes)
			{
				// /api/getitemtypelist.aspx tends to reports stale stuff...
				if (itemType.Value == null) continue;

				var name = GetName(itemType.Value.PrefLabel);
				
				Console.WriteLine("Adding item type {0}", name);
				
				rsEntries.Add(new ItemTypeEntry()
				{
					Uri = itemType.Uri,
					Name = name,
					Enabled = true
				});
			}
		}

		private static void ImportReferenceStructures()
		{
			// load reference structures: delete and add
			var rsEntries = DoorzoekerConfig.Current.ReferenceStructures;
			var cfgStructures = rsEntries.ToLookup(rs => rs.Uri);

			var repository = s_session.ReferenceStructureRepository;

			var all = repository.All().ToList();

			// remove structures that no longer exist
			foreach (var structure in rsEntries.ToList())
			{
				if (all.SingleOrDefault(rs => rs.Uri == structure.Uri) == null)
				{
					Console.WriteLine("Removing structure {0}", structure.Name);
					rsEntries.Remove(structure);
				}
			}

			// Add missing structures
			var missingStructures = all.Where(rs => !cfgStructures.Contains(rs.Uri));
			foreach (var structure in missingStructures)
			{
				var name = GetName(structure.Value.PrefLabel);

				Console.WriteLine("Adding structure {0}", name);

				rsEntries.Add(new ReferenceStructureEntry()
					{
						Uri = structure.Uri,
						Name = name,
						Enabled = true
					});
			}
		}

		private static string GetName(IEnumerable<SkosProperty> prefLabels)
		{
			return DoorzoekerModelMapper.DeterminePreferredLabel(prefLabels).Value;
		}

		private static void InitInstance()
		{
			s_container = SimpleInjectorInitializer.Initialize();

			s_session = s_container.GetInstance<RnaSession>();
		}

		private static void LoadConfig(string configName)
		{
			var configFilePathName = s_instanceRegistry.Get(configName).Config;

			DoorzoekerConfig.Current = DoorzoekerConfig.Load(configFilePathName);
		}

		private static void CreateConfig(string instanceName, string siteName)
		{
			var configPath = MakeAbsolute(Path.Combine(Environment.CurrentDirectory, @"..\.."));
			
			var cfgFile = Path.Combine(configPath, string.Format("Doorzoeker.{0}.cfg", instanceName));
			var atCfg = new DoorzoekerConfig();
			atCfg.Save(cfgFile);

			s_instanceRegistry.Add(new Instance(instanceName, siteName, cfgFile, "1.0"));
			s_instanceRegistry.Save();
		}

		private static string MakeAbsolute(string path)
		{
			return new Uri(path).LocalPath;
		}

	}
}
