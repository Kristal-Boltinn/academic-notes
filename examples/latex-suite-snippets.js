// Merge these entries into your existing LaTeX Suite snippets array.
// Expand on a blank, top-level line with Tab. No automatic block IDs are inserted.
[
  {
    "trigger": "athm",
    "replacement": "> [!thm] ${0:Title}\n> ${1:Content}\n\n$2",
    "options": "tw",
    "description": "Academic Notes thm"
  },
  {
    "trigger": "aproof",
    "replacement": "> [!proof] ${0:Title}\n> ${1:Content}\n\n$2",
    "options": "tw",
    "description": "Academic Notes proof"
  },
  {
    "trigger": "aremark",
    "replacement": "> [!remark] ${0:Title}\n> ${1:Content}\n\n$2",
    "options": "tw",
    "description": "Academic Notes remark"
  },
  {
    "trigger": "subfig2",
    "replacement": "> [!figure|cols=auto height=${0:180}] ${1:Group caption}\n> > [!subfigure] ${2:Caption 1}\n> > ![[${3:image-1.png}]]\n>\n> > [!subfigure] ${4:Caption 2}\n> > ![[${5:image-2.png}]]\n>\n\n$6",
    "options": "tw",
    "description": "2 subfigures with shared image height"
  },
  {
    "trigger": "subfig3",
    "replacement": "> [!figure|cols=auto height=${0:180}] ${1:Group caption}\n> > [!subfigure] ${2:Caption 1}\n> > ![[${3:image-1.png}]]\n>\n> > [!subfigure] ${4:Caption 2}\n> > ![[${5:image-2.png}]]\n>\n> > [!subfigure] ${6:Caption 3}\n> > ![[${7:image-3.png}]]\n>\n\n$8",
    "options": "tw",
    "description": "3 subfigures with shared image height"
  },
  {
    "trigger": "subfig4",
    "replacement": "> [!figure|cols=auto height=${0:180}] ${1:Group caption}\n> > [!subfigure] ${2:Caption 1}\n> > ![[${3:image-1.png}]]\n>\n> > [!subfigure] ${4:Caption 2}\n> > ![[${5:image-2.png}]]\n>\n> > [!subfigure] ${6:Caption 3}\n> > ![[${7:image-3.png}]]\n>\n> > [!subfigure] ${8:Caption 4}\n> > ![[${9:image-4.png}]]\n>\n\n$10",
    "options": "tw",
    "description": "4 subfigures with shared image height"
  },
  {
    "trigger": "subfig6",
    "replacement": "> [!figure|cols=auto height=${0:180}] ${1:Group caption}\n> > [!subfigure] ${2:Caption 1}\n> > ![[${3:image-1.png}]]\n>\n> > [!subfigure] ${4:Caption 2}\n> > ![[${5:image-2.png}]]\n>\n> > [!subfigure] ${6:Caption 3}\n> > ![[${7:image-3.png}]]\n>\n> > [!subfigure] ${8:Caption 4}\n> > ![[${9:image-4.png}]]\n>\n> > [!subfigure] ${10:Caption 5}\n> > ![[${11:image-5.png}]]\n>\n> > [!subfigure] ${12:Caption 6}\n> > ![[${13:image-6.png}]]\n>\n\n$14",
    "options": "tw",
    "description": "6 subfigures with shared image height"
  }
]
