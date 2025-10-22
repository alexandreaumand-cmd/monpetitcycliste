export const UI_CONSTANTS = {
  // Containers
  maxWidth: 'max-w-7xl',
  mainPadding: 'px-4 py-6 md:px-6 md:py-8',
  
  // Spacing
  sectionGap: 'space-y-6',
  cardGap: 'gap-4',
  headerGap: 'gap-4',
  
  // Typography
  pageTitle: 'text-3xl font-bold tracking-tight',
  pageSubtitle: 'text-muted-foreground mt-1',
  sectionTitle: 'text-2xl font-semibold',
  
  // Cards
  card: 'rounded-lg border bg-card text-card-foreground shadow-sm',
  cardHover: 'hover:shadow-lg hover:scale-[1.02] transition-all duration-200',
  cardPadding: 'p-6',
  
  // Filters
  filterWidth: 'w-full md:w-[250px]',
  stickyFilter: 'sticky top-0 z-10 bg-background pb-4 border-b',
  
  // Grids
  gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  gridGap: 'gap-4 md:gap-6',
} as const;
