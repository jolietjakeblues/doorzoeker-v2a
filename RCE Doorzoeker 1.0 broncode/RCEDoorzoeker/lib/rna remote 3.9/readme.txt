Version 3.9 (RCE Doorzoeker branch 5.1)
======================================
- Fixed concurrency issues with adding cache items. Now using .NET 4's MemoryCache with 30 minute sliding expiration.
- The MemoryCache is a .NET 4 class, upgraded library to use .NET 4.5 (for maintaining .NET 3.5 requirements need an external/abstract cache object).
- Added read-only ReferenceStructure property on Items

Version 3.8
======================================
- Added server provided Uri support. RnaRemote does not generate uri's anymore but uses a list provided by the server.
- Support for commiting a unit of work of related newly created items without manually assigning uri's (uri's get assigned when calling adding a new item to a repository).

Version 3.7
======================================
- Statements pointing to objects are not returned through the type of ResourceStatements. Pure literal statements no longer have ObjectContentItem related properties.
- Removed InternalId from ReferenceStructure.. required temporary disabling of ReferenceStructure operations (create/edit).
- Removed SubContent uri's from items.
- Support for inlined Annex items in content xml.
- No longer need to include the EntityRepository assembly as a seperate dependency
- RnaCore is now called RnaRemote

Version 3.6
======================================

- Added autoIndex toggle to RnaApiConnector. Makes the server skip index updates per item (makes commits a lot faster). Can result in stale data, new mutations are not directly findable through the query interface. When using a RnaContext.Open overload that does not take a RnaApiConnector (RnaContext will create one itself) an optional parameter staleCommits can be set to true to get the same behaviour.

Version 3.5
======================================

- Fix: Items retrieved through Find have broken lazy loading mechanics.

Version 3.4
======================================

- Various fixed around paged results and unit-of-work tracking, caching and lazy loading of linked/referenced items
- Fix: predicate uri not properly parsed from statement data
- Fix: statement parsing now skips the null statement the server includes in it's XML when an item has no statements.

Version 3.3
======================================

- Find method on repositories now returns paged results. Pages are materialized immediately to reduce http traffic, no dereferencing needed on SearchResult (which was removed). 
- Items now have a NumberOfChildren (int) and HasChildren (boolean) property.
- Repositories now support Any queries.

Version 3.2
======================================
- Fix: GetFromRecycleBin incorrectly circumventing cached nulls

- Fix: Changed all remote api calls to use application/x-www-form-urlencoded POSTs to avoid problematic long URLs.

- Fix: ResourceCollection doesn't support ToList() because CopyTo() is not implemented.

- Added ability to mark content items as being an annex item using
	
	someContentItem.IsAnnexItem = true/false

- Name changes are no longer possible after having commited/persisted an item. Trying to set the Name property result in an OperationNotSupportedException.

- Fix: Code Generator breaks on predicates which are arranged in an hierarchy.

- Fix: Find methods on ContentItemRepository, PredicateRepository, ItemTypeRepository and ReferenceStructureRepository returning incorrect types. (PredicateRepository.Find could return ContentItems etc)

Version 3.1
======================================
- RecycleBin operations are now part of the unit of work

- ListByStatementXXX methods have been removed from ContentItemRepository and been made into regular StatementCriteria

	Example:

	ContentItemRepository.ListByStatementObject(hasType, milltype_achtkante_stellingmolen_uri);

	is equivalent to:

	ContentItemRepository.Find(StatementCriteria
									.Statement(hasType)
									.MatchingContentItem(milltype_achtkante_stellingmolen_uri)
								);

- renamed the RecyleBinCriteria methods:
	AllItems -> RecycleBinIndifferent
	ItemsInRecycleBin -> InRecycleBin

- Added RecycleBinCriteria NotInRecycleBin

- Fix: Fulltext matching using wildcards. Queries were incorrectly formatted.

- Improved error detection on the server side, things like permission problems should now be a trappable exception on the client.
